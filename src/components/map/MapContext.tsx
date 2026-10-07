import type maplibregl from 'maplibre-gl';
import React, { createContext, useContext, useState } from 'react';

import type { Coordinate } from '../../core/common/types';
import type { BikeConfig, RulesConfiguration, SemanticTurnType } from '../../core/config';
import type { MapEvent } from '../../core/events/types';
import type { GraphNode, StreetGraph } from '../../core/graph/types';
import type { InspectorBranchEvaluation } from '../../core/inspector/types';
import type { Landmark } from '../../core/landmarks/types';
import type { NavigationState, RideStats } from '../../core/navigation/types';
import type { StrategyRouteVariant } from '../../core/router/types';
import { useIntersectionBranches } from '../../hooks/useIntersectionBranches';
import type { ToolbarMode } from '../SideToolbar';

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
  routeVariants: StrategyRouteVariant[];
  activeAlternativeLabel: 'standard' | 'avoid-stops' | 'quiet-streets';
  onSelectAlternative: (label: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  customNodeDelays: Map<string, number>;
  customNodeNotes: Map<string, string>;
  customNodeTurns: Map<string, Record<string, SemanticTurnType>>;
  selectedNode: GraphNode | null;
  onStartDrag: (coord: Coordinate | null) => void;
  onEndDrag: (coord: Coordinate | null) => void;
  onNodeSelect: (node: GraphNode | null) => void;
  onSaveNodeOverride: (nodeId: string, delay: number, notes: string) => void;
  onSaveNodeTurns: (nodeId: string, turns: Record<string, SemanticTurnType>) => void;
  onClearNodeOverride: (nodeId: string) => void;
  theme: 'bright' | 'liberty' | 'dark';

  isInspectorModeActive: boolean;
  onToggleInspectorMode: () => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedAlternativeTargetId: string | null;
  setSelectedAlternativeTargetId: (id: string | null) => void;
  inspectorBranches: InspectorBranchEvaluation[];

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

  // Studio & Selection states
  appMode: ToolbarMode;
  setAppMode: (mode: ToolbarMode) => void;
  landmarks: Landmark[];
  setLandmarks: React.Dispatch<React.SetStateAction<Landmark[]>>;
  selectedEdgeIds: string[];
  setSelectedEdgeIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectionTool: 'click' | 'brush';
  setSelectionTool: (tool: 'click' | 'brush') => void;
  brushRadius: number;
  setBrushRadius: (radius: number) => void;
  events: MapEvent[];
  setEvents: React.Dispatch<React.SetStateAction<MapEvent[]>>;
  onClearSelection: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const MapContext = createContext<MapContextType | null>(null);

interface MapProviderProps {
  graph: StreetGraph | null;
  loadedBBoxes: [number, number, number, number][];
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeVariants: StrategyRouteVariant[];
  activeAlternativeLabel: 'standard' | 'avoid-stops' | 'quiet-streets';
  onSelectAlternative: (label: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  customNodeDelays: Map<string, number>;
  customNodeNotes: Map<string, string>;
  customNodeTurns: Map<string, Record<string, SemanticTurnType>>;
  selectedNode: GraphNode | null;
  onStartDrag: (coord: Coordinate | null) => void;
  onEndDrag: (coord: Coordinate | null) => void;
  onNodeSelect: (node: GraphNode | null) => void;
  onSaveNodeOverride: (nodeId: string, delay: number, notes: string) => void;
  onSaveNodeTurns: (nodeId: string, turns: Record<string, SemanticTurnType>) => void;
  onClearNodeOverride: (nodeId: string) => void;
  theme: 'bright' | 'liberty' | 'dark';
  isInspectorModeActive: boolean;
  onToggleInspectorMode: () => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedAlternativeTargetId: string | null;
  setSelectedAlternativeTargetId: (id: string | null) => void;
  rulesConfig: RulesConfiguration;
  bikeConfig: BikeConfig;
  navigationState: NavigationState;
  isNavigating: boolean;
  rideStats: RideStats | null;
  onStopNavigation: () => void;
  appMode?: ToolbarMode;
  onAppModeChange?: (mode: ToolbarMode) => void;
  initialAppMode?: ToolbarMode;
  landmarks?: Landmark[];
  onLandmarksChange?: React.Dispatch<React.SetStateAction<Landmark[]>>;
  initialLandmarks?: Landmark[];
  selectedEdgeIds?: string[];
  onSelectedEdgeIdsChange?: React.Dispatch<React.SetStateAction<string[]>>;
  initialSelectedEdgeIds?: string[];
  initialSelectionTool?: 'click' | 'brush';
  initialBrushRadius?: number;
  events?: MapEvent[];
  onEventsChange?: React.Dispatch<React.SetStateAction<MapEvent[]>>;
  initialEvents?: MapEvent[];
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
  routeVariants,
  activeAlternativeLabel,
  onSelectAlternative,
  selectedPreset,
  customNodeDelays,
  customNodeNotes,
  customNodeTurns,
  selectedNode,
  onStartDrag,
  onEndDrag,
  onNodeSelect,
  onSaveNodeOverride,
  onSaveNodeTurns,
  onClearNodeOverride,
  theme,
  isInspectorModeActive,
  onToggleInspectorMode,
  selectedNodeId,
  setSelectedNodeId,
  selectedAlternativeTargetId,
  setSelectedAlternativeTargetId,
  rulesConfig,
  bikeConfig,
  navigationState,
  isNavigating,
  rideStats,
  onStopNavigation,
  appMode: controlledAppMode,
  onAppModeChange,
  initialAppMode,
  landmarks: controlledLandmarks,
  onLandmarksChange,
  initialLandmarks,
  selectedEdgeIds: controlledSelectedEdgeIds,
  onSelectedEdgeIdsChange,
  initialSelectedEdgeIds,
  initialSelectionTool,
  initialBrushRadius,
  events: controlledEvents,
  onEventsChange,
  initialEvents,
  children,
}) => {
  const activeRoute = routeVariants.find((r) => r.label === activeAlternativeLabel);
  const routeResult = activeRoute ? activeRoute.result : null;

  const inspectorBranches = useIntersectionBranches({
    selectedNodeId,
    routeResult,
    graph,
    overrides: {
      nodeDelays: customNodeDelays,
      nodeNotes: customNodeNotes,
      nodeTurns: customNodeTurns,
      rulesConfig,
      bikeConfig,
    },
    activeStrategyLabel: activeAlternativeLabel,
  });

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

  const [internalAppMode, setInternalAppMode] = useState<ToolbarMode>(initialAppMode ?? 'routing');
  const appMode = controlledAppMode ?? internalAppMode;
  const setAppMode = onAppModeChange ?? setInternalAppMode;

  const [internalLandmarks, setInternalLandmarks] = useState<Landmark[]>(initialLandmarks ?? []);
  const landmarks = controlledLandmarks ?? internalLandmarks;
  const setLandmarks = onLandmarksChange ?? setInternalLandmarks;

  const [internalSelectedEdgeIds, setInternalSelectedEdgeIds] = useState<string[]>(
    initialSelectedEdgeIds ?? [],
  );
  const selectedEdgeIds = controlledSelectedEdgeIds ?? internalSelectedEdgeIds;
  const setSelectedEdgeIds = onSelectedEdgeIdsChange ?? setInternalSelectedEdgeIds;

  const [selectionTool, setSelectionTool] = useState<'click' | 'brush'>(
    initialSelectionTool ?? 'click',
  );
  const [brushRadius, setBrushRadius] = useState<number>(initialBrushRadius ?? 40);

  const [internalEvents, setInternalEvents] = useState<MapEvent[]>(initialEvents ?? []);
  const events = controlledEvents ?? internalEvents;
  const setEvents = onEventsChange ?? setInternalEvents;

  const onClearSelection = () => {
    setSelectedEdgeIds([]);
  };

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
        routeVariants,
        activeAlternativeLabel,
        onSelectAlternative,
        selectedPreset,
        customNodeDelays,
        customNodeNotes,
        customNodeTurns,
        selectedNode,
        onStartDrag,
        onEndDrag,
        onNodeSelect,
        onSaveNodeOverride,
        onSaveNodeTurns,
        onClearNodeOverride,
        theme,
        isInspectorModeActive,
        onToggleInspectorMode,
        selectedNodeId,
        setSelectedNodeId,
        selectedAlternativeTargetId,
        setSelectedAlternativeTargetId,
        inspectorBranches,
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
        appMode,
        setAppMode,
        landmarks,
        setLandmarks,
        selectedEdgeIds,
        setSelectedEdgeIds,
        selectionTool,
        setSelectionTool,
        brushRadius,
        setBrushRadius,
        events,
        setEvents,
        onClearSelection,
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
