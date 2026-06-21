import { useEffect, useMemo, useState } from 'react';

import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { snapCoordinateToEdge } from './core/common/geo';
import type { Coordinate } from './core/common/types';
import type { RouteAlternative } from './core/router/types';
import { useInspectorMode } from './hooks/useInspectorMode';
import { useNavigation } from './hooks/useNavigation';
import { useOSMData } from './hooks/useOSMData';
import { useOverrides } from './hooks/useOverrides';
import { useRoutingState } from './hooks/useRoutingState';

/**
 * Main application component for the Ciclista routing dashboard.
 * Coordinates map state, routing logic, sidebar panels, preset configurations,
 * and local storage overrides.
 */
export default function App() {
  const [selectedPreset, setSelectedPreset] = useState<'munich' | 'amsterdam'>('munich');
  const [theme, setTheme] = useState<'bright' | 'liberty' | 'dark'>('bright');

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
    rulesConfig,
    setRulesConfig,
    bikeConfig,
    setBikeConfig,
    currentOverrides,
    handleSaveNodeOverride,
    handleClearNodeOverride,
  } = useOverrides();

  // Instantiate hooks to manage routing state and OSM fetching
  const routing = useRoutingState();
  const osmData = useOSMData({
    startCoord: routing.startCoord,
    endCoord: routing.endCoord,
    setSelectedPreset,
    setSelectedNode: routing.setSelectedNode,
    onFetchFallback: () => {
      routing.setStartCoord(null);
      routing.setEndCoord(null);
    },
  });

  const { graph, loadedBBoxes, isFetchingOSM, handlePresetChange, handleMapBoundsChange } = osmData;
  const {
    startCoord,
    setStartCoord,
    endCoord,
    setEndCoord,
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

  // Wrapper for preset changes to also reset active markers
  const onPresetChange = (preset: 'munich' | 'amsterdam') => {
    setStartCoord(null);
    setEndCoord(null);
    handlePresetChange(preset);
  };

  // 4. Reactive Concurrent Routing Calculation via WebWorker
  const [routeAlternatives, setRouteAlternatives] = useState<RouteAlternative[]>([]);

  useEffect(() => {
    if (!graph || !startCoord || !endCoord) {
      Promise.resolve().then(() => {
        setRouteAlternatives((prev) => (prev.length === 0 ? prev : []));
      });
      return;
    }

    const worker = new Worker(new URL('./core/router/router.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e) => {
      const { routeAlternatives: alts, error } = e.data;
      if (error) {
        console.error('Worker routing error:', error);
      } else if (alts) {
        setRouteAlternatives(alts);
      }
    };

    worker.postMessage({
      graph,
      startCoord,
      endCoord,
      overrides: currentOverrides,
    });

    return () => {
      worker.terminate();
    };
  }, [graph, startCoord, endCoord, currentOverrides]);

  const routeResult = useMemo(() => {
    const active = routeAlternatives.find((alt) => alt.label === routingStrategy);
    return active ? active.result : null;
  }, [routeAlternatives, routingStrategy]);

  const navigation = useNavigation({
    routeResult,
    routeCoordinates: routeResult?.coordinates ?? [],
  });

  return (
    <div className="app-container">
      <Sidebar
        startCoord={startCoord}
        endCoord={endCoord}
        routeResult={routeResult}
        routeAlternatives={routeAlternatives}
        routingStrategy={routingStrategy}
        isFetchingOSM={isFetchingOSM}
        onStrategyChange={setRoutingStrategy}
        selectedPreset={selectedPreset}
        onPresetChange={onPresetChange}
        rulesConfig={rulesConfig}
        onRulesChange={setRulesConfig}
        bikeConfig={bikeConfig}
        onBikeConfigChange={setBikeConfig}
        theme={theme}
        onThemeChange={setTheme}
        isNavigating={navigation.state.status === 'active' || navigation.state.status === 'paused'}
        onStartNavigation={navigation.startNavigation}
        onStopNavigation={navigation.stopNavigation}
        navigationProgress={navigation.state.progress}
        onToggleCameraMode={navigation.toggleCameraMode}
        cameraMode={navigation.state.cameraMode}
        isInspectorModeActive={isInspectorModeActive}
        selectedNodeId={selectedNodeId}
        onToggleInspectorMode={toggleInspectorMode}
        onSelectNodeId={setSelectedNodeId}
        selectedAlternativeTargetId={selectedAlternativeTargetId}
        setSelectedAlternativeTargetId={setSelectedAlternativeTargetId}
      />
      <MapView
        graph={graph}
        loadedBBoxes={loadedBBoxes}
        startCoord={startCoord}
        endCoord={endCoord}
        routeAlternatives={routeAlternatives}
        activeAlternativeLabel={routingStrategy}
        onSelectAlternative={setRoutingStrategy}
        selectedPreset={selectedPreset}
        customNodeDelays={nodeDelays}
        customNodeNotes={nodeNotes}
        selectedNode={selectedNode}
        onStartDrag={handleStartDrag}
        onEndDrag={handleEndDrag}
        onNodeSelect={setSelectedNode}
        onSaveNodeOverride={handleSaveNodeOverride}
        onClearNodeOverride={handleClearNodeOverride}
        onMapBoundsChange={handleMapBoundsChange}
        theme={theme}
        isInspectorModeActive={isInspectorModeActive}
        selectedNodeId={selectedNodeId}
        setSelectedNodeId={setSelectedNodeId}
        selectedAlternativeTargetId={selectedAlternativeTargetId}
        setSelectedAlternativeTargetId={setSelectedAlternativeTargetId}
        navigationState={navigation.state}
        isNavigating={navigation.state.status === 'active' || navigation.state.status === 'paused'}
        rideStats={navigation.rideStats}
        onStopNavigation={navigation.stopNavigation}
      />
    </div>
  );
}
