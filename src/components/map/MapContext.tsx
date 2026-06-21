import type maplibregl from 'maplibre-gl';
import React, { createContext, useContext, useState } from 'react';

import type { Coordinate } from '../../core/common/types';
import type { GraphNode, StreetGraph } from '../../core/graph/types';
import type { NavigationState, RideStats } from '../../core/navigation/types';
import type { RouteAlternative } from '../../core/router/types';

/**
 * Context menu display state structure.
 */
export interface ContextMenuData {
  visible: boolean;
  x: number;
  y: number;
  lng: number;
  lat: number;
  crossingId: string | null;
  nodeIds: string | null;
}

/**
 * Context type defining all map orchestrator states and actions.
 */
export interface MapContextType {
  map: maplibregl.Map | null;
  setMap: React.Dispatch<React.SetStateAction<maplibregl.Map | null>>;
  mapReady: boolean;
  setMapReady: React.Dispatch<React.SetStateAction<boolean>>;
  graph: StreetGraph | null;
  loadedBBoxes: [number, number, number, number][];
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeAlternatives: RouteAlternative[];
  activeAlternativeLabel: 'standard' | 'avoid-stops' | 'quiet-streets';
  onSelectAlternative: (label: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  customNodeDelays: Map<string, number>;
  customNodeNotes: Map<string, string>;
  selectedNode: GraphNode | null;
  onStartDrag: (coord: Coordinate | null) => void;
  onEndDrag: (coord: Coordinate | null) => void;
  onNodeSelect: (node: GraphNode | null) => void;
  onSaveNodeOverride: (nodeId: string, delay: number, notes: string) => void;
  onClearNodeOverride: (nodeId: string) => void;
  theme: 'bright' | 'liberty' | 'dark';

  isInspectorModeActive: boolean;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Declarative camera fitting state
  shouldFitBounds: boolean;
  setShouldFitBounds: (val: boolean) => void;

  // View states
  showMinorControls: boolean;
  setShowMinorControls: (val: boolean) => void;
  dockExpanded: boolean;
  setDockExpanded: React.Dispatch<React.SetStateAction<boolean>>;

  // Cluster and override management states
  managedClusterId: string | null;
  setManagedClusterId: (val: string | null) => void;
  managedNodeIds: string[];
  setManagedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Context menu state
  contextMenu: ContextMenuData;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuData>>;

  // Navigation states
  navigationState: NavigationState;
  isNavigating: boolean;
  rideStats: RideStats | null;
  onStopNavigation: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const MapContext = createContext<MapContextType | null>(null);

interface MapProviderProps {
  graph: StreetGraph | null;
  loadedBBoxes: [number, number, number, number][];
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeAlternatives: RouteAlternative[];
  activeAlternativeLabel: 'standard' | 'avoid-stops' | 'quiet-streets';
  onSelectAlternative: (label: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  customNodeDelays: Map<string, number>;
  customNodeNotes: Map<string, string>;
  selectedNode: GraphNode | null;
  onStartDrag: (coord: Coordinate | null) => void;
  onEndDrag: (coord: Coordinate | null) => void;
  onNodeSelect: (node: GraphNode | null) => void;
  onSaveNodeOverride: (nodeId: string, delay: number, notes: string) => void;
  onClearNodeOverride: (nodeId: string) => void;
  theme: 'bright' | 'liberty' | 'dark';
  isInspectorModeActive: boolean;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  navigationState: NavigationState;
  isNavigating: boolean;
  rideStats: RideStats | null;
  onStopNavigation: () => void;
  children: React.ReactNode;
}

/**
 * MapProvider Component that hosts state and operations for the map subcomponents.
 *
 * @param props - Component properties including the map instance and router states.
 * @returns React elements wrapping children in MapContext.Provider.
 */
export const MapProvider: React.FC<MapProviderProps> = ({
  graph,
  loadedBBoxes,
  startCoord,
  endCoord,
  routeAlternatives,
  activeAlternativeLabel,
  onSelectAlternative,
  selectedPreset,
  customNodeDelays,
  customNodeNotes,
  selectedNode,
  onStartDrag,
  onEndDrag,
  onNodeSelect,
  onSaveNodeOverride,
  onClearNodeOverride,
  theme,
  isInspectorModeActive,
  selectedNodeId,
  setSelectedNodeId,
  navigationState,
  isNavigating,
  rideStats,
  onStopNavigation,
  children,
}) => {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [shouldFitBounds, setShouldFitBounds] = useState(true);
  const [showMinorControls, setShowMinorControls] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(true);
  const [managedClusterId, setManagedClusterId] = useState<string | null>(null);
  const [managedNodeIds, setManagedNodeIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuData>({
    visible: false,
    x: 0,
    y: 0,
    lng: 0,
    lat: 0,
    crossingId: null,
    nodeIds: null,
  });

  return (
    <MapContext.Provider
      value={{
        map,
        setMap,
        mapReady,
        setMapReady,
        graph,
        loadedBBoxes,
        startCoord,
        endCoord,
        routeAlternatives,
        activeAlternativeLabel,
        onSelectAlternative,
        selectedPreset,
        customNodeDelays,
        customNodeNotes,
        selectedNode,
        onStartDrag,
        onEndDrag,
        onNodeSelect,
        onSaveNodeOverride,
        onClearNodeOverride,
        theme,
        isInspectorModeActive,
        selectedNodeId,
        setSelectedNodeId,
        shouldFitBounds,
        setShouldFitBounds,
        showMinorControls,
        setShowMinorControls,
        dockExpanded,
        setDockExpanded,
        managedClusterId,
        setManagedClusterId,
        managedNodeIds,
        setManagedNodeIds,
        contextMenu,
        setContextMenu,
        navigationState,
        isNavigating,
        rideStats,
        onStopNavigation,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

/**
 * Hook to consume MapContext.
 *
 * @returns The map context.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useMapContext = (): MapContextType => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};
