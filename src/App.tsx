import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { GlobalControlsPanel } from './components/GlobalControlsPanel';
import { MapProvider } from './components/map/MapContext';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { SideToolbar, type ToolbarMode } from './components/SideToolbar';
import {
  calculateMultiPointBoundingBox,
  doBBoxesIntersect,
  snapCoordinateToEdge,
} from './core/common/geo';
import type { Coordinate } from './core/common/types';
import type { LocalOverrides } from './core/config/types';
import type { MapEvent } from './core/events';
import type { StreetGraph } from './core/graph/types';
import type {
  StrategyRouteVariant,
  WorkerRoutingRequest,
  WorkerRoutingResponse,
} from './core/router/types';
import { LocalStorageProvider } from './core/storage/storage';
import { useInspectorMode } from './hooks/useInspectorMode';
import { useNavigation } from './hooks/useNavigation';
import { useOSMData } from './hooks/useOSMData';
import { useOverrides } from './hooks/useOverrides';
import { usePlaces } from './hooks/usePlaces';
import { useRoutingState } from './hooks/useRoutingState';

const storage = new LocalStorageProvider();

const TestRunnerPage = React.lazy(() => import('./components/test/TestRunnerPage'));

interface DashboardAppProps {
  onNavigate?: (path: string) => void;
}

/**
 * Primary dashboard view component executing main map and routing hooks.
 */
function DashboardApp({ onNavigate }: DashboardAppProps) {
  const [theme, setTheme] = useState<'bright' | 'liberty' | 'dark'>(() => {
    return storage.loadTheme() ?? 'bright';
  });
  const [appMode, setAppMode] = useState<ToolbarMode>('routing');
  const [events, setEvents] = useState<MapEvent[]>(() => {
    return storage.loadEventsSync();
  });
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  useEffect(() => {
    storage.saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    storage.saveEventsSync(events);
  }, [events]);

  const { places, addPlace, updatePlace, deletePlace, setPlaces } = usePlaces();

  const {
    isInspectorModeActive,
    selectedNodeId,
    setSelectedNodeId,
    selectedAlternativeTargetId,
    setSelectedAlternativeTargetId,
    toggleInspectorMode,
    resetInspectorMode,
  } = useInspectorMode();

  // Load custom storage overrides state and rules config using the custom hook
  const {
    nodeDelays,
    nodeNotes,
    nodeTurns,
    crossingTurns,
    rulesConfig,
    setRulesConfig,
    bikeConfig,
    setBikeConfig,
    currentOverrides,
    handleSaveNodeOverride,
    handleSaveNodeTurns,
    handleClearNodeOverride,
    handleSaveCrossingTurn,
    handleDeleteCrossingTurn,
  } = useOverrides();

  // Instantiate hooks to manage routing state and OSM fetching
  const routing = useRoutingState();
  const osmData = useOSMData({
    startCoord: routing.startCoord,
    endCoord: routing.endCoord,
    setSelectedNode: routing.setSelectedNode,
    onFetchFallback: () => {
      routing.setStartCoord(null);
      routing.setEndCoord(null);
    },
  });

  const { graph, loadedBBoxes, isFetchingOSM, handleMapBoundsChange } = osmData;
  const {
    startCoord,
    setStartCoord,
    endCoord,
    setEndCoord,
    waypoints,
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    selectedNode,
    setSelectedNode,
    routingStrategy,
    setRoutingStrategy,
  } = routing;

  // Reset inspector mode if start or end coordinates change
  useEffect(() => {
    resetInspectorMode();
  }, [startCoord, endCoord, resetInspectorMode]);

  const handleStartDrag = (coord: Coordinate | null) => {
    setStartCoord(coord ? snapCoordinateToEdge(coord, graph) : null);
  };

  const handleEndDrag = (coord: Coordinate | null) => {
    setEndCoord(coord ? snapCoordinateToEdge(coord, graph) : null);
  };

  const handleSwapCoords = () => {
    setStartCoord(endCoord);
    setEndCoord(startCoord);
  };

  const effectiveOverrides: LocalOverrides = useMemo(() => {
    const blockedEdges = new Set<string>();
    for (const ev of events) {
      if (ev.active && ev.effect.type === 'road_blockage') {
        for (const edgeId of ev.edgeIds) {
          blockedEdges.add(edgeId);
        }
      }
    }
    return {
      ...currentOverrides,
      events,
      blockedEdges,
    };
  }, [currentOverrides, events]);

  // 4. Reactive Concurrent Routing Calculation via WebWorker
  const [routeVariants, setRouteVariants] = useState<StrategyRouteVariant[]>([]);
  const routerWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      return;
    }

    const worker = new Worker(new URL('./core/router/router.worker.ts', import.meta.url), {
      type: 'module',
    });
    routerWorkerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerRoutingResponse>) => {
      const { routeVariants: alts, error } = e.data;
      if (error) {
        console.error('Worker routing error:', error);
      } else if (alts) {
        setRouteVariants(alts);
      }
    };

    return () => {
      worker.terminate();
      routerWorkerRef.current = null;
    };
  }, []);

  const prevStartCoordRef = useRef<Coordinate | null>(null);
  const prevEndCoordRef = useRef<Coordinate | null>(null);
  const prevWaypointsRef = useRef<Coordinate[] | undefined>(undefined);
  const prevOverridesRef = useRef<LocalOverrides | null>(null);
  const prevGraphRef = useRef<StreetGraph | null>(null);
  const prevLoadedBBoxesRef = useRef<[number, number, number, number][]>([]);

  useEffect(() => {
    if (!graph || !startCoord || !endCoord) {
      prevGraphRef.current = graph;
      prevStartCoordRef.current = startCoord;
      prevEndCoordRef.current = endCoord;
      prevWaypointsRef.current = waypoints;
      prevOverridesRef.current = effectiveOverrides;
      prevLoadedBBoxesRef.current = loadedBBoxes;
      Promise.resolve().then(() => {
        setRouteVariants((prev) => (prev.length === 0 ? prev : []));
      });
      return;
    }

    const worker = routerWorkerRef.current;
    if (!worker) {
      return;
    }

    const coordsChanged =
      prevStartCoordRef.current !== startCoord ||
      prevEndCoordRef.current !== endCoord ||
      prevWaypointsRef.current !== waypoints;

    const overridesChanged = prevOverridesRef.current !== effectiveOverrides;
    const isInitialGraph = prevGraphRef.current === null;

    // Check if any newly merged bounding boxes intersect the active route bounding box
    const previousBBoxes = prevLoadedBBoxesRef.current;
    const newBBoxes = loadedBBoxes.slice(previousBBoxes.length);

    let routeIntersectsNewChunks = false;
    if (newBBoxes.length > 0) {
      const allRoutePoints = [startCoord, ...(waypoints || []), endCoord];
      const routeBBox = calculateMultiPointBoundingBox(allRoutePoints);
      routeIntersectsNewChunks = newBBoxes.some((b) => doBBoxesIntersect(b, routeBBox));
    }

    // Always update tracking refs
    prevGraphRef.current = graph;
    prevStartCoordRef.current = startCoord;
    prevEndCoordRef.current = endCoord;
    prevWaypointsRef.current = waypoints;
    prevOverridesRef.current = effectiveOverrides;
    prevLoadedBBoxesRef.current = loadedBBoxes;

    // If only background chunks merged that do not intersect the route area, skip recalculation
    if (!isInitialGraph && !coordsChanged && !overridesChanged && !routeIntersectsNewChunks) {
      return;
    }

    const request: WorkerRoutingRequest = {
      graph,
      startCoord,
      endCoord,
      waypoints,
      overrides: effectiveOverrides,
    };
    worker.postMessage(request);
  }, [graph, loadedBBoxes, startCoord, endCoord, waypoints, effectiveOverrides]);

  const routeResult = useMemo(() => {
    const active = routeVariants.find((alt) => alt.label === routingStrategy);
    return active ? active.result : null;
  }, [routeVariants, routingStrategy]);

  const navigation = useNavigation({
    routeResult,
    routeCoordinates: routeResult?.coordinates ?? [],
  });

  return (
    <MapProvider
      graph={graph}
      loadedBBoxes={loadedBBoxes}
      startCoord={startCoord}
      endCoord={endCoord}
      routeVariants={routeVariants}
      activeAlternativeLabel={routingStrategy}
      onSelectAlternative={setRoutingStrategy}
      customNodeDelays={nodeDelays}
      customNodeNotes={nodeNotes}
      customNodeTurns={nodeTurns}
      rulesConfig={rulesConfig}
      bikeConfig={bikeConfig}
      selectedNode={selectedNode}
      onStartDrag={handleStartDrag}
      onEndDrag={handleEndDrag}
      onNodeSelect={setSelectedNode}
      onSaveNodeOverride={handleSaveNodeOverride}
      onSaveNodeTurns={handleSaveNodeTurns}
      onClearNodeOverride={handleClearNodeOverride}
      theme={theme}
      isInspectorModeActive={isInspectorModeActive}
      onToggleInspectorMode={toggleInspectorMode}
      selectedNodeId={selectedNodeId}
      setSelectedNodeId={setSelectedNodeId}
      selectedAlternativeTargetId={selectedAlternativeTargetId}
      setSelectedAlternativeTargetId={setSelectedAlternativeTargetId}
      navigationState={navigation.state}
      isNavigating={navigation.state.status === 'active' || navigation.state.status === 'paused'}
      rideStats={navigation.rideStats}
      onStopNavigation={navigation.stopNavigation}
      appMode={appMode}
      onAppModeChange={setAppMode}
      places={places}
      onPlacesChange={setPlaces}
      onCreatePlace={addPlace}
      onUpdatePlace={updatePlace}
      onDeletePlace={deletePlace}
      landmarks={places}
      onLandmarksChange={setPlaces}
      onCreateLandmark={addPlace}
      onUpdateLandmark={updatePlace}
      onDeleteLandmark={deletePlace}
      events={events}
      onEventsChange={setEvents}
      selectedEdgeIds={selectedEdgeIds}
      onSelectedEdgeIdsChange={setSelectedEdgeIds}
      crossingTurns={crossingTurns}
      onSaveCrossingTurn={handleSaveCrossingTurn}
      onDeleteCrossingTurn={handleDeleteCrossingTurn}
    >
      <div className="app-container">
        <SideToolbar
          mode={appMode}
          onModeChange={setAppMode}
          onOpenTestRunner={() => {
            if (onNavigate) {
              onNavigate('/test');
            } else if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/test');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }}
        />
        <Sidebar
          startCoord={startCoord}
          endCoord={endCoord}
          waypoints={waypoints}
          onAddWaypoint={addWaypoint}
          onRemoveWaypoint={removeWaypoint}
          onUpdateWaypoint={updateWaypoint}
          routeResult={routeResult}
          routeVariants={routeVariants}
          routingStrategy={routingStrategy}
          isFetchingOSM={isFetchingOSM}
          onStrategyChange={setRoutingStrategy}
          onSwapCoords={handleSwapCoords}
          rulesConfig={rulesConfig}
          onRulesChange={setRulesConfig}
          bikeConfig={bikeConfig}
          onBikeConfigChange={setBikeConfig}
          isNavigating={
            navigation.state.status === 'active' || navigation.state.status === 'paused'
          }
          onStartNavigation={navigation.startNavigation}
          onStopNavigation={navigation.stopNavigation}
          navigationProgress={navigation.state.progress}
          onToggleCameraMode={navigation.toggleCameraMode}
          cameraMode={navigation.state.cameraMode}
          isInspectorModeActive={isInspectorModeActive}
          selectedNodeId={selectedNodeId}
          onSelectNodeId={setSelectedNodeId}
          selectedAlternativeTargetId={selectedAlternativeTargetId}
          setSelectedAlternativeTargetId={setSelectedAlternativeTargetId}
          appMode={appMode}
          events={events}
          selectedEdgeIds={selectedEdgeIds}
          onClearSelection={() => setSelectedEdgeIds([])}
          places={places}
          onCreatePlace={addPlace}
          onUpdatePlace={updatePlace}
          onDeletePlace={deletePlace}
          landmarks={places}
          onCreateLandmark={addPlace}
          onUpdateLandmark={updatePlace}
          onDeleteLandmark={deletePlace}
          onSetStartCoord={handleStartDrag}
          onSetEndCoord={handleEndDrag}
        />
        <MapView onMapBoundsChange={handleMapBoundsChange} />
        <GlobalControlsPanel theme={theme} onThemeChange={setTheme} />
      </div>
    </MapProvider>
  );
}

/**
 * Root application component performing route selection between dashboard and visual test runner.
 */
export default function App() {
  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleNavigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  const isTestRoute = currentPath === '/test';

  if (isTestRoute) {
    return (
      <div
        onClick={(e) => {
          const target = (e.target as HTMLElement).closest('a');
          if (target && target.getAttribute('href') === '/') {
            e.preventDefault();
            handleNavigate('/');
          }
        }}
      >
        <Suspense fallback={<div className="app-suspense-fallback">Loading Test Dashboard...</div>}>
          <TestRunnerPage />
        </Suspense>
      </div>
    );
  }

  return <DashboardApp onNavigate={handleNavigate} />;
}
