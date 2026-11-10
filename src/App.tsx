import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GlobalControlsPanel } from './components/GlobalControlsPanel';
import { MapProvider } from './components/map/MapContext';
import { MapView } from './components/MapView';
import { SearchEverywhereModal, type SearchTab } from './components/SearchEverywhereModal';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { SideToolbar, type ToolbarMode } from './components/SideToolbar';
import type { ActionContext } from './core/actions/types';
import {
  calculateMultiPointBoundingBox,
  doBBoxesIntersect,
  snapCoordinateToEdge,
} from './core/common/geo';
import type { Coordinate } from './core/common/types';
import type { AppSettings } from './core/config/settings';
import type { SettingCategory } from './core/config/settingsMetadata';
import type { BikeProfile, LocalOverrides } from './core/config/types';
import type { MapEvent } from './core/events';
import type { StreetGraph } from './core/graph/types';
import type { Landmark } from './core/landmarks/types';
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
import { settingsStore, useSettings } from './store/settingsStore';

const storage = new LocalStorageProvider();

const TestRunnerPage = React.lazy(() => import('./components/test/TestRunnerPage'));

interface DashboardAppProps {
  onNavigate?: (path: string) => void;
}

/**
 * Primary dashboard view component executing main map and routing hooks.
 */
function DashboardApp({ onNavigate }: DashboardAppProps) {
  const settings = useSettings();
  const theme = settings.theme;
  const [appMode, setAppMode] = useState<ToolbarMode>('routing');
  const [events, setEvents] = useState<MapEvent[]>(() => {
    return storage.loadEventsSync();
  });
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  // Modal visibility states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingCategory | undefined>();
  const [settingsHighlightKey, setSettingsHighlightKey] = useState<keyof AppSettings | undefined>();
  const [isSearchAllOpen, setIsSearchAllOpen] = useState(false);
  const [searchAllInitialTab, setSearchAllInitialTab] = useState<SearchTab>('all');

  const handleOpenSettings = useCallback((category?: SettingCategory, highlightKey?: string) => {
    setSettingsCategory(category);
    setSettingsHighlightKey(highlightKey as keyof AppSettings | undefined);
    setIsSettingsOpen(true);
  }, []);

  const handleOpenSearchAll = useCallback((tab: SearchTab = 'all') => {
    setSearchAllInitialTab(tab);
    setIsSearchAllOpen(true);
  }, []);

  const handleThemeChange = useCallback((nextTheme: 'bright' | 'liberty' | 'dark') => {
    settingsStore.updateSettings({ theme: nextTheme });
  }, []);

  useEffect(() => {
    storage.saveEventsSync(events);
  }, [events]);

  const lastShiftTapTimeRef = useRef<number>(0);
  const shiftKeyDownTimeRef = useRef<number>(0);
  const shiftConsumedRef = useRef<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      // Standalone Shift double-press detection
      if (e.key === 'Shift') {
        if (isInputFocused || e.repeat) {
          shiftConsumedRef.current = true;
          return;
        }

        const now = Date.now();
        shiftKeyDownTimeRef.current = now;
        shiftConsumedRef.current = false;

        if (
          lastShiftTapTimeRef.current > 0 &&
          now - lastShiftTapTimeRef.current < 400 &&
          now - lastShiftTapTimeRef.current > 40
        ) {
          e.preventDefault();
          handleOpenSearchAll('all');
          lastShiftTapTimeRef.current = 0;
          shiftKeyDownTimeRef.current = 0;
          shiftConsumedRef.current = true;
          return;
        }
        return;
      }

      // Any non-Shift key cancels the standalone Shift tap sequence
      shiftConsumedRef.current = true;
      lastShiftTapTimeRef.current = 0;

      // Settings shortcut: Ctrl+, or Cmd+,
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        handleOpenSettings();
        return;
      }

      // Search Everywhere shortcut: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        handleOpenSearchAll('all');
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        const now = Date.now();
        const pressDuration = now - shiftKeyDownTimeRef.current;
        if (!shiftConsumedRef.current && pressDuration < 300 && shiftKeyDownTimeRef.current > 0) {
          lastShiftTapTimeRef.current = now;
        } else {
          lastShiftTapTimeRef.current = 0;
        }
      }
    };

    const handlePointerInteraction = () => {
      shiftConsumedRef.current = true;
      lastShiftTapTimeRef.current = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointerdown', handlePointerInteraction, { capture: true });
    window.addEventListener('mousedown', handlePointerInteraction, { capture: true });
    window.addEventListener('wheel', handlePointerInteraction, { capture: true, passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointerdown', handlePointerInteraction, { capture: true });
      window.removeEventListener('mousedown', handlePointerInteraction, { capture: true });
      window.removeEventListener('wheel', handlePointerInteraction, { capture: true });
    };
  }, [handleOpenSearchAll, handleOpenSettings]);

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
  const overrides = useOverrides() as ReturnType<typeof useOverrides> & {
    bikes?: BikeProfile[];
    activeBikeId?: string;
    setActiveBikeId?: (id: string) => void;
  };
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
  } = overrides;

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

  const {
    graph,
    loadedBBoxes,
    loadedChunkIds,
    isFetchingOSM,
    handleMapBoundsChange,
    refreshChunk,
  } = osmData;
  const {
    startCoord,
    setStartCoord,
    endCoord,
    setEndCoord,
    waypoints,
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    reorderWaypoints,
    isPlacingStop,
    setIsPlacingStop,
    placingStopIndex,
    setPlacingStopIndex,
    startPlacingStop,
    cancelPlacingStop,
    selectedNode,
    setSelectedNode,
    routingStrategy,
    setRoutingStrategy,
  } = routing;

  // Reset inspector mode if start or end coordinates change
  useEffect(() => {
    resetInspectorMode();
  }, [startCoord, endCoord, resetInspectorMode]);

  // Reset stop placement mode on appMode switch or unmount
  useEffect(() => {
    cancelPlacingStop();
  }, [appMode, cancelPlacingStop]);

  const handleStartDrag = (coord: Coordinate | null) => {
    setStartCoord(coord ? snapCoordinateToEdge(coord, graph) : null);
  };

  const handleEndDrag = (coord: Coordinate | null) => {
    setEndCoord(coord ? snapCoordinateToEdge(coord, graph) : null);
  };

  const handleUpdateWaypoint = useCallback(
    (index: number, coord: Coordinate) => {
      if (!coord || typeof coord.lat !== 'number' || typeof coord.lng !== 'number') return;
      const snapped = snapCoordinateToEdge(coord, graph);
      updateWaypoint(index, snapped);
    },
    [graph, updateWaypoint],
  );

  const handleAddWaypoint = useCallback(
    (coord?: Coordinate) => {
      if (!coord || typeof coord.lat !== 'number' || typeof coord.lng !== 'number') return;
      const snapped = snapCoordinateToEdge(coord, graph);
      addWaypoint(snapped);
    },
    [graph, addWaypoint],
  );

  const handleSwapCoords = useCallback(() => {
    setStartCoord(endCoord);
    setEndCoord(startCoord);
  }, [startCoord, endCoord, setStartCoord, setEndCoord]);

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

    // Filter waypoints defensively to only include valid placed coordinates
    const validWaypoints = (waypoints || []).filter(
      (w) =>
        w &&
        typeof w.lat === 'number' &&
        typeof w.lng === 'number' &&
        !isNaN(w.lat) &&
        !isNaN(w.lng) &&
        (w.lat !== 0 || w.lng !== 0),
    );

    // Check if any newly merged bounding boxes intersect the active route bounding box
    const previousBBoxes = prevLoadedBBoxesRef.current;
    const newBBoxes = loadedBBoxes.slice(previousBBoxes.length);

    let routeIntersectsNewChunks = false;
    if (newBBoxes.length > 0) {
      const allRoutePoints = [startCoord, ...validWaypoints, endCoord];
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
      waypoints: validWaypoints,
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

  const actionContext: ActionContext = useMemo(
    () => ({
      settings,
      updateSettings: (newSettings) => settingsStore.updateSettings(newSettings),
      appMode,
      setAppMode,
      routing: {
        startCoord: startCoord ? [startCoord.lat, startCoord.lng] : null,
        endCoord: endCoord ? [endCoord.lat, endCoord.lng] : null,
        hasActiveRoute: Boolean(routeResult),
        routingStrategy,
        bikeConfig,
        swapStartEnd: handleSwapCoords,
        clearRoute: () => {
          setStartCoord(null);
          setEndCoord(null);
        },
        setRoutingStrategy: (strategy: string) => {
          setRoutingStrategy(strategy as 'standard' | 'avoid-stops' | 'quiet-streets');
        },
        setBikeConfig,
      },
      navigation: {
        isNavigating: navigation.state.status === 'active' || navigation.state.status === 'paused',
        cameraMode: navigation.state.cameraMode,
        startNavigation: navigation.startNavigation,
        stopNavigation: navigation.stopNavigation,
        toggleCameraMode: navigation.toggleCameraMode,
      },
      map: {
        showStreetGraph: settings.showStreetGraph,
        toggleStreetGraph: () => {
          settingsStore.updateSettings({ showStreetGraph: !settings.showStreetGraph });
        },
        isInspectorActive: isInspectorModeActive,
        toggleInspector: toggleInspectorMode,
      },
      places: {
        places: places as unknown as Landmark[],
        selectPlace: (p: Landmark) => {
          setStartCoord({ lat: p.lat, lng: p.lng });
          setIsSearchAllOpen(false);
        },
      },
      openSettings: handleOpenSettings,
      openSearchAll: handleOpenSearchAll,
    }),
    [
      settings,
      appMode,
      startCoord,
      endCoord,
      routeResult,
      routingStrategy,
      bikeConfig,
      handleSwapCoords,
      setStartCoord,
      setEndCoord,
      setRoutingStrategy,
      setBikeConfig,
      navigation.state.status,
      navigation.state.cameraMode,
      navigation.startNavigation,
      navigation.stopNavigation,
      navigation.toggleCameraMode,
      isInspectorModeActive,
      toggleInspectorMode,
      places,
      handleOpenSettings,
      handleOpenSearchAll,
    ],
  );

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
      waypoints={waypoints}
      onAddWaypoint={handleAddWaypoint}
      onRemoveWaypoint={removeWaypoint}
      onUpdateWaypoint={handleUpdateWaypoint}
      onReorderWaypoints={reorderWaypoints}
      isPlacingStop={isPlacingStop}
      onPlacingStopChange={setIsPlacingStop}
      placingStopIndex={placingStopIndex}
      onPlacingStopIndexChange={setPlacingStopIndex}
      onStartPlacingStop={startPlacingStop}
      onCancelPlacingStop={cancelPlacingStop}
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
      loadedChunkIds={loadedChunkIds}
      onRefreshChunk={refreshChunk}
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
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenSettings={() => handleOpenSettings()}
          onOpenSearchAll={() => handleOpenSearchAll('all')}
        />
        <Sidebar
          bikes={overrides.bikes}
          activeBikeId={overrides.activeBikeId}
          onSelectBike={overrides.setActiveBikeId}
          routeResult={routeResult}
          isFetchingOSM={isFetchingOSM}
          waypoints={waypoints}
          onAddWaypoint={handleAddWaypoint}
          onRemoveWaypoint={removeWaypoint}
          onUpdateWaypoint={handleUpdateWaypoint}
          onReorderWaypoints={reorderWaypoints}
          isPlacingStop={isPlacingStop}
          placingStopIndex={placingStopIndex}
          onStartPlacingStop={startPlacingStop}
          onSwapCoords={handleSwapCoords}
          rulesConfig={rulesConfig}
          onRulesChange={setRulesConfig}
          bikeConfig={bikeConfig}
          onBikeConfigChange={setBikeConfig}
          onStartNavigation={navigation.startNavigation}
          onStopNavigation={navigation.stopNavigation}
          onToggleCameraMode={navigation.toggleCameraMode}
          cameraMode={navigation.state.cameraMode}
          navigationProgress={navigation.state.progress}
        />
        <MapView onMapBoundsChange={handleMapBoundsChange} />
        <GlobalControlsPanel theme={theme} onThemeChange={handleThemeChange} />
        {isProfileOpen && null}
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            initialCategory={settingsCategory}
            highlightKey={settingsHighlightKey}
          />
        )}
        {isSearchAllOpen && (
          <SearchEverywhereModal
            isOpen={isSearchAllOpen}
            onClose={() => setIsSearchAllOpen(false)}
            initialTab={searchAllInitialTab}
            actionContext={actionContext}
            onOpenSettings={(cat, key) => {
              setIsSearchAllOpen(false);
              handleOpenSettings(cat, key);
            }}
          />
        )}
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
