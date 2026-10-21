import type * as maplibregl from 'maplibre-gl';
import React, { useCallback, useMemo, useState } from 'react';

import type { Coordinate } from '../../core/common/types';
import type {
  BikeConfig,
  CrossingTurnOverride,
  RulesConfiguration,
  SemanticTurnType,
} from '../../core/config';
import type { MapEvent } from '../../core/events/types';
import type { GraphNode, StreetGraph } from '../../core/graph/types';
import {
  createLandmark as createLandmarkDomain,
  deleteLandmark as deleteLandmarkDomain,
  updateLandmark as updateLandmarkDomain,
} from '../../core/landmarks/landmarks';
import type {
  CreateLandmarkInput,
  Landmark,
  UpdateLandmarkInput,
} from '../../core/landmarks/types';
import type { NavigationState, RideStats } from '../../core/navigation/types';
import type { StrategyRouteVariant } from '../../core/router/types';
import { useIntersectionBranches } from '../../hooks/useIntersectionBranches';
import type { ToolbarMode } from '../SideToolbar';
import {
  type ContextMenuData,
  CrossingEditorContext,
  type CrossingEditorContextType,
  type LandmarkModalState,
  MapContext,
  type MapContextType,
  MapInstanceContext,
  type MapInstanceContextType,
  NavigationStateContext,
  type NavigationStateContextType,
  RoutingStateContext,
  type RoutingStateContextType,
  StudioStateContext,
  type StudioStateContextType,
} from './MapContext';

/**
 * Properties for the MapProvider component.
 */
export interface MapProviderProps {
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
  places?: Landmark[];
  onPlacesChange?: React.Dispatch<React.SetStateAction<Landmark[]>>;
  initialPlaces?: Landmark[];
  selectedEdgeIds?: string[];
  onSelectedEdgeIdsChange?: React.Dispatch<React.SetStateAction<string[]>>;
  initialSelectedEdgeIds?: string[];
  initialSelectionTool?: 'click' | 'brush';
  initialBrushRadius?: number;
  events?: MapEvent[];
  onEventsChange?: React.Dispatch<React.SetStateAction<MapEvent[]>>;
  initialEvents?: MapEvent[];
  onCreateLandmark?: (input: CreateLandmarkInput) => void;
  onCreatePlace?: (input: CreateLandmarkInput) => void;
  onUpdateLandmark?: (id: string, updates: UpdateLandmarkInput) => void;
  onUpdatePlace?: (id: string, updates: UpdateLandmarkInput) => void;
  onDeleteLandmark?: (id: string) => void;
  onDeletePlace?: (id: string) => void;
  isPlacingPlace?: boolean;
  onPlacingPlaceChange?: React.Dispatch<React.SetStateAction<boolean>>;
  initialIsPlacingPlace?: boolean;
  crossingTurns?: CrossingTurnOverride[];
  onSaveCrossingTurn?: (override: CrossingTurnOverride) => void;
  onDeleteCrossingTurn?: (id: string) => void;
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
  places: controlledPlaces,
  onPlacesChange,
  initialPlaces,
  selectedEdgeIds: controlledSelectedEdgeIds,
  onSelectedEdgeIdsChange,
  initialSelectedEdgeIds,
  initialSelectionTool,
  initialBrushRadius,
  events: controlledEvents,
  onEventsChange,
  initialEvents,
  onCreateLandmark: onCreateLandmarkProp,
  onCreatePlace: onCreatePlaceProp,
  onUpdateLandmark: onUpdateLandmarkProp,
  onUpdatePlace: onUpdatePlaceProp,
  onDeleteLandmark: onDeleteLandmarkProp,
  onDeletePlace: onDeletePlaceProp,
  isPlacingPlace: controlledIsPlacingPlace,
  onPlacingPlaceChange,
  initialIsPlacingPlace,
  crossingTurns: controlledCrossingTurns,
  onSaveCrossingTurn: onSaveCrossingTurnProp,
  onDeleteCrossingTurn: onDeleteCrossingTurnProp,
  children,
}) => {
  const activeRoute = routeVariants.find((r) => r.label === activeAlternativeLabel);
  const routeResult = activeRoute ? activeRoute.result : null;

  const inspectorOverrides = useMemo(
    () => ({
      nodeDelays: customNodeDelays,
      nodeNotes: customNodeNotes,
      nodeTurns: customNodeTurns,
      rulesConfig,
      bikeConfig,
    }),
    [customNodeDelays, customNodeNotes, customNodeTurns, rulesConfig, bikeConfig],
  );

  const inspectorBranches = useIntersectionBranches({
    selectedNodeId,
    routeResult,
    graph,
    overrides: inspectorOverrides,
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
    placeId: null,
  });

  const [internalAppMode, setInternalAppMode] = useState<ToolbarMode>(initialAppMode ?? 'routing');
  const appMode = controlledAppMode ?? internalAppMode;
  const setAppMode = onAppModeChange ?? setInternalAppMode;

  const [internalLandmarks, setInternalLandmarks] = useState<Landmark[]>(
    initialPlaces ?? initialLandmarks ?? [],
  );
  const landmarks = controlledPlaces ?? controlledLandmarks ?? internalLandmarks;
  const setLandmarks = onPlacesChange ?? onLandmarksChange ?? setInternalLandmarks;

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

  const [internalIsPlacingPlace, setInternalIsPlacingPlace] = useState(
    initialIsPlacingPlace ?? false,
  );
  const isPlacingPlace = controlledIsPlacingPlace ?? internalIsPlacingPlace;
  const setIsPlacingPlace = onPlacingPlaceChange ?? setInternalIsPlacingPlace;

  const [activeCrossingId, setActiveCrossingId] = useState<string | null>(null);
  const [activeTurnSelection, setActiveTurnSelection] = useState<{
    fromNodeId: string | null;
    toNodeId: string | null;
    waypointNodeIds: string[];
  }>({
    fromNodeId: null,
    toNodeId: null,
    waypointNodeIds: [],
  });
  const [internalCrossingTurns, setInternalCrossingTurns] = useState<CrossingTurnOverride[]>([]);
  const crossingTurns = controlledCrossingTurns ?? internalCrossingTurns;

  const handleSaveCrossingTurn = useCallback(
    (override: CrossingTurnOverride) => {
      if (onSaveCrossingTurnProp) {
        onSaveCrossingTurnProp(override);
      } else {
        setInternalCrossingTurns((prev) => {
          const idx = prev.findIndex((t) => t.id === override.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = override;
            return next;
          }
          return [...prev, override];
        });
      }
    },
    [onSaveCrossingTurnProp],
  );

  const handleDeleteCrossingTurn = useCallback(
    (id: string) => {
      if (onDeleteCrossingTurnProp) {
        onDeleteCrossingTurnProp(id);
      } else {
        setInternalCrossingTurns((prev) => prev.filter((t) => t.id !== id));
      }
    },
    [onDeleteCrossingTurnProp],
  );

  const [landmarkModal, setLandmarkModal] = useState<LandmarkModalState>({
    isOpen: false,
    landmark: null,
    initialCoordinates: null,
  });

  const openCreateLandmarkModal = useCallback((coord?: Coordinate | null) => {
    setLandmarkModal({
      isOpen: true,
      landmark: null,
      initialCoordinates: coord ?? null,
    });
  }, []);

  const openEditLandmarkModal = useCallback((landmark: Landmark) => {
    setLandmarkModal({
      isOpen: true,
      landmark,
      initialCoordinates: { lat: landmark.lat, lng: landmark.lng },
    });
  }, []);

  const closeLandmarkModal = useCallback(() => {
    setLandmarkModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleCreateLandmark = useCallback(
    (input: CreateLandmarkInput) => {
      const fn = onCreatePlaceProp ?? onCreateLandmarkProp;
      if (fn) {
        fn(input);
      } else {
        const created = createLandmarkDomain(input);
        setLandmarks((prev) => [created, ...prev]);
      }
    },
    [onCreatePlaceProp, onCreateLandmarkProp, setLandmarks],
  );

  const handleUpdateLandmark = useCallback(
    (id: string, updates: UpdateLandmarkInput) => {
      const fn = onUpdatePlaceProp ?? onUpdateLandmarkProp;
      if (fn) {
        fn(id, updates);
      } else {
        setLandmarks((prev) =>
          prev.map((item) => (item.id === id ? updateLandmarkDomain(item, updates) : item)),
        );
      }
    },
    [onUpdatePlaceProp, onUpdateLandmarkProp, setLandmarks],
  );

  const handleDeleteLandmark = useCallback(
    (id: string) => {
      const fn = onDeletePlaceProp ?? onDeleteLandmarkProp;
      if (fn) {
        fn(id);
      } else {
        setLandmarks((prev) => deleteLandmarkDomain(prev, id));
      }
    },
    [onDeletePlaceProp, onDeleteLandmarkProp, setLandmarks],
  );

  const onClearSelection = useCallback(() => {
    setSelectedEdgeIds([]);
  }, [setSelectedEdgeIds]);

  const mapInstanceValue = useMemo<MapInstanceContextType>(
    () => ({
      map,
      setMap,
      mapReady,
      setMapReady,
      theme,
      shouldFitBounds,
      setShouldFitBounds,
      dockExpanded,
      setDockExpanded,
      contextMenu,
      setContextMenu,
      appMode,
      setAppMode,
    }),
    [
      map,
      setMap,
      mapReady,
      setMapReady,
      theme,
      shouldFitBounds,
      setShouldFitBounds,
      dockExpanded,
      setDockExpanded,
      contextMenu,
      setContextMenu,
      appMode,
      setAppMode,
    ],
  );

  const routingStateValue = useMemo<RoutingStateContextType>(
    () => ({
      graph,
      loadedBBoxes,
      startCoord,
      endCoord,
      routeVariants,
      activeAlternativeLabel,
      onSelectAlternative,
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
      showMinorControls,
      setShowMinorControls,
      managedClusterId,
      setManagedClusterId,
      managedNodeIds,
      setManagedNodeIds,
      isInspectorModeActive,
      onToggleInspectorMode,
      selectedNodeId,
      setSelectedNodeId,
      selectedAlternativeTargetId,
      setSelectedAlternativeTargetId,
      inspectorBranches,
    }),
    [
      graph,
      loadedBBoxes,
      startCoord,
      endCoord,
      routeVariants,
      activeAlternativeLabel,
      onSelectAlternative,
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
      showMinorControls,
      setShowMinorControls,
      managedClusterId,
      setManagedClusterId,
      managedNodeIds,
      setManagedNodeIds,
      isInspectorModeActive,
      onToggleInspectorMode,
      selectedNodeId,
      setSelectedNodeId,
      selectedAlternativeTargetId,
      setSelectedAlternativeTargetId,
      inspectorBranches,
    ],
  );

  const navigationStateValue = useMemo<NavigationStateContextType>(
    () => ({
      navigationState,
      isNavigating,
      rideStats,
      onStopNavigation,
    }),
    [navigationState, isNavigating, rideStats, onStopNavigation],
  );

  const studioStateValue = useMemo<StudioStateContextType>(
    () => ({
      places: landmarks,
      setPlaces: setLandmarks,
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
      placeModal: landmarkModal,
      setPlaceModal: setLandmarkModal,
      landmarkModal,
      setLandmarkModal,
      openCreatePlace: openCreateLandmarkModal,
      openCreatePlaceModal: openCreateLandmarkModal,
      openCreateLandmarkModal,
      openEditPlaceModal: openEditLandmarkModal,
      openEditLandmarkModal,
      closePlaceModal: closeLandmarkModal,
      closeLandmarkModal,
      onCreatePlace: handleCreateLandmark,
      onCreateLandmark: handleCreateLandmark,
      onUpdatePlace: handleUpdateLandmark,
      onUpdateLandmark: handleUpdateLandmark,
      onDeletePlace: handleDeleteLandmark,
      onDeleteLandmark: handleDeleteLandmark,
      isPlacingPlace,
      setIsPlacingPlace,
    }),
    [
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
      landmarkModal,
      setLandmarkModal,
      openCreateLandmarkModal,
      openEditLandmarkModal,
      closeLandmarkModal,
      handleCreateLandmark,
      handleUpdateLandmark,
      handleDeleteLandmark,
      isPlacingPlace,
      setIsPlacingPlace,
    ],
  );

  const crossingEditorValue = useMemo<CrossingEditorContextType>(
    () => ({
      activeCrossingId,
      setActiveCrossingId,
      activeTurnSelection,
      setActiveTurnSelection,
      crossingTurns,
      onSaveCrossingTurn: handleSaveCrossingTurn,
      onDeleteCrossingTurn: handleDeleteCrossingTurn,
    }),
    [
      activeCrossingId,
      setActiveCrossingId,
      activeTurnSelection,
      setActiveTurnSelection,
      crossingTurns,
      handleSaveCrossingTurn,
      handleDeleteCrossingTurn,
    ],
  );

  const contextValue = useMemo<MapContextType>(
    () => ({
      ...mapInstanceValue,
      ...routingStateValue,
      ...navigationStateValue,
      ...studioStateValue,
      ...crossingEditorValue,
    }),
    [
      mapInstanceValue,
      routingStateValue,
      navigationStateValue,
      studioStateValue,
      crossingEditorValue,
    ],
  );

  return (
    <MapInstanceContext.Provider value={mapInstanceValue}>
      <RoutingStateContext.Provider value={routingStateValue}>
        <NavigationStateContext.Provider value={navigationStateValue}>
          <StudioStateContext.Provider value={studioStateValue}>
            <CrossingEditorContext.Provider value={crossingEditorValue}>
              <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>
            </CrossingEditorContext.Provider>
          </StudioStateContext.Provider>
        </NavigationStateContext.Provider>
      </RoutingStateContext.Provider>
    </MapInstanceContext.Provider>
  );
};
