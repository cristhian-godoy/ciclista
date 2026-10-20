import type * as maplibregl from 'maplibre-gl';
import type React from 'react';
import { createContext, useContext } from 'react';

import type { Coordinate } from '../../core/common/types';
import type { CrossingTurnOverride, SemanticTurnType } from '../../core/config';
import type { MapEvent } from '../../core/events/types';
import type { GraphNode, StreetGraph } from '../../core/graph/types';
import type { InspectorBranchEvaluation } from '../../core/inspector/types';
import type {
  CreateLandmarkInput,
  Landmark,
  UpdateLandmarkInput,
} from '../../core/landmarks/types';
import type { NavigationState, RideStats } from '../../core/navigation/types';
import type { StrategyRouteVariant } from '../../core/router/types';
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
  placeId?: string | null;
}

/**
 * State representing landmark/place creation or editing modal visibility and data.
 */
export interface LandmarkModalState {
  isOpen: boolean;
  landmark: Landmark | null;
  initialCoordinates: Coordinate | null;
}

/**
 * State representing place modal visibility, entity data, and spatial coordinates.
 */
export type PlaceModalState = LandmarkModalState;

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
  places?: Landmark[];
  setPlaces?: React.Dispatch<React.SetStateAction<Landmark[]>>;
  selectedEdgeIds: string[];
  setSelectedEdgeIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectionTool: 'click' | 'brush';
  setSelectionTool: (tool: 'click' | 'brush') => void;
  brushRadius: number;
  setBrushRadius: (radius: number) => void;
  events: MapEvent[];
  setEvents: React.Dispatch<React.SetStateAction<MapEvent[]>>;
  onClearSelection: () => void;

  // Landmark/Place modal and operations
  landmarkModal?: LandmarkModalState;
  setLandmarkModal?: React.Dispatch<React.SetStateAction<LandmarkModalState>>;
  placeModal?: PlaceModalState;
  setPlaceModal?: React.Dispatch<React.SetStateAction<PlaceModalState>>;
  openCreateLandmarkModal?: (coord?: Coordinate | null) => void;
  openCreatePlaceModal?: (coord?: Coordinate | null) => void;
  openEditLandmarkModal?: (landmark: Landmark) => void;
  openEditPlaceModal?: (place: Landmark) => void;
  closeLandmarkModal?: () => void;
  closePlaceModal?: () => void;
  onCreateLandmark?: (input: CreateLandmarkInput) => void;
  onCreatePlace?: (input: CreateLandmarkInput) => void;
  onUpdateLandmark?: (id: string, updates: UpdateLandmarkInput) => void;
  onUpdatePlace?: (id: string, updates: UpdateLandmarkInput) => void;
  onDeleteLandmark?: (id: string) => void;
  onDeletePlace?: (id: string) => void;

  // Place pin placement mode
  isPlacingPlace?: boolean;
  setIsPlacingPlace?: React.Dispatch<React.SetStateAction<boolean>> | ((val: boolean) => void);

  // Crossing Editor states
  activeCrossingId?: string | null;
  setActiveCrossingId?: (id: string | null) => void;
  activeTurnSelection?: {
    fromNodeId: string | null;
    toNodeId: string | null;
    waypointNodeIds: string[];
  };
  setActiveTurnSelection?: React.Dispatch<
    React.SetStateAction<{
      fromNodeId: string | null;
      toNodeId: string | null;
      waypointNodeIds: string[];
    }>
  >;
  crossingTurns?: CrossingTurnOverride[];
  onSaveCrossingTurn?: (override: CrossingTurnOverride) => void;
  onDeleteCrossingTurn?: (id: string) => void;
}

/**
 * Primary React context instance providing MapContextType values to map component hierarchy.
 */
export const MapContext = createContext<MapContextType | null>(null);

/**
 * React hook to consume the nearest MapContext.
 *
 * @returns Active MapContextType value.
 * @throws Error when consumed outside of a MapProvider hierarchy.
 */
export function useMapContext(): MapContextType {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
}
