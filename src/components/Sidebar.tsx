import React, { useContext, useState } from 'react';

import type { Coordinate } from '../core/common/types';
import type { BikeConfig, RulesConfiguration } from '../core/config';
import type { MapEvent } from '../core/events';
import {
  createLandmark as createLandmarkDomain,
  deleteLandmark as deleteLandmarkDomain,
  updateLandmark as updateLandmarkDomain,
} from '../core/landmarks/landmarks';
import type { CreateLandmarkInput, Landmark, UpdateLandmarkInput } from '../core/landmarks/types';
import type { CameraMode, NavigationProgress } from '../core/navigation/types';
import type { RouteResult, StrategyRouteVariant } from '../core/router/types';
import { AttributionPanel } from './AttributionPanel';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GitFork,
  Route,
  ShieldAlert,
  Star,
} from './common/Icon';
import { CrossingEditPanel } from './CrossingEditPanel';
import { EventsPanel } from './EventsPanel';
import { InspectorPanel } from './InspectorPanel';
import {
  MapInstanceContext,
  NavigationStateContext,
  RoutingStateContext,
  StudioStateContext,
} from './map/MapContext';
import { NavigationControlCard } from './NavigationControlCard';
import { PlacesPanel } from './PlacesPanel';
import { RouteComparePanel } from './RouteComparePanel';
import { RouteStatsPanel } from './RouteStatsPanel';
import { RoutingConfigPanel } from './RoutingConfigPanel';
import { RulesConfigPanel } from './RulesConfigPanel';
import type { ToolbarMode } from './SideToolbar';

/**
 * Properties for the main dashboard Sidebar component.
 */
export interface SidebarProps {
  startCoord?: Coordinate | null;
  endCoord?: Coordinate | null;
  routeResult: RouteResult | null;
  routeVariants?: StrategyRouteVariant[];
  routingStrategy?: 'standard' | 'avoid-stops' | 'quiet-streets';
  isFetchingOSM: boolean;
  onStrategyChange?: (strategy: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  /**
   * Callback fired when swapping start and end route coordinates.
   */
  onSwapCoords?: () => void;
  rulesConfig: RulesConfiguration;
  onRulesChange: (config: RulesConfiguration) => void;
  bikeConfig: BikeConfig;
  onBikeConfigChange: (config: BikeConfig) => void;
  isNavigating?: boolean;
  onStartNavigation: () => void;
  onStopNavigation?: () => void;
  navigationProgress: NavigationProgress | null;
  onToggleCameraMode: () => void;
  cameraMode: CameraMode;
  isInspectorModeActive?: boolean;
  selectedNodeId?: string | null;
  onSelectNodeId?: (id: string | null) => void;
  selectedAlternativeTargetId?: string | null;
  setSelectedAlternativeTargetId?: (id: string | null) => void;
  /**
   * Active application workflow mode ('routing', 'places', 'events', 'studio', or 'edit').
   */
  appMode?: ToolbarMode;
  /**
   * Current list of events.
   */
  events?: MapEvent[];
  /**
   * Currently selected road segment IDs.
   */
  selectedEdgeIds?: string[];
  /**
   * Current list of favorite places.
   */
  places?: Landmark[];
  /**
   * Alias for places collection.
   * @deprecated Use `places` instead.
   */
  landmarks?: Landmark[];
  /**
   * Callback fired when creating a new event in Events mode.
   */
  onCreateEvent?: (name: string, description?: string) => void;
  /**
   * Callback fired when toggling an event active status.
   */
  onToggleEvent?: (id: string) => void;
  /**
   * Callback fired when deleting an event.
   */
  onDeleteEvent?: (id: string) => void;
  /**
   * Callback fired when clearing the active edge selection.
   */
  onClearSelection?: () => void;
  /**
   * Callback fired when creating a new landmark or place.
   * @deprecated Use `onCreatePlace` instead.
   */
  onCreateLandmark?: (input: CreateLandmarkInput) => void;
  /**
   * Callback fired when creating a new place.
   */
  onCreatePlace?: (input: CreateLandmarkInput) => void;
  /**
   * Callback fired when modifying a landmark or place.
   * @deprecated Use `onUpdatePlace` instead.
   */
  onUpdateLandmark?: (id: string, updates: UpdateLandmarkInput) => void;
  /**
   * Callback fired when modifying a place.
   */
  onUpdatePlace?: (id: string, updates: UpdateLandmarkInput) => void;
  /**
   * Callback fired when deleting a landmark or place.
   * @deprecated Use `onDeletePlace` instead.
   */
  onDeleteLandmark?: (id: string) => void;
  /**
   * Callback fired when deleting a place.
   */
  onDeletePlace?: (id: string) => void;
  /**
   * Callback fired when setting start route pin from a place.
   */
  onSetStartCoord?: (coord: Coordinate) => void;
  /**
   * Callback fired when setting end route pin from a place.
   */
  onSetEndCoord?: (coord: Coordinate) => void;
  /**
   * Whether the application is currently in pin placement mode for a new place.
   */
  isPlacingPlace?: boolean;
  /**
   * Callback fired when pin placement mode changes.
   */
  onPlacingPlaceChange?: (isPlacing: boolean) => void;
  /**
   * Intermediate route waypoints between start and destination.
   */
  waypoints?: Coordinate[];
  /**
   * Callback fired to append a new intermediate waypoint.
   */
  onAddWaypoint?: () => void;
  /**
   * Callback fired to remove an intermediate waypoint by index.
   */
  onRemoveWaypoint?: (index: number) => void;
  /**
   * Callback fired to update coordinates of an intermediate waypoint.
   */
  onUpdateWaypoint?: (index: number, coord: Coordinate) => void;
  /**
   * Callback fired to reorder intermediate waypoints.
   */
  onReorderWaypoints?: (fromIndex: number, toIndex: number) => void;
  /**
   * Whether intermediate stop placement mode is active.
   */
  isPlacingStop?: boolean;
  /**
   * Index of intermediate stop being repositioned on the map.
   */
  placingStopIndex?: number | null;
  /**
   * Callback fired to initiate intermediate stop placement on map.
   */
  onStartPlacingStop?: (index?: number) => void;
}

/**
 * Main dashboard sidebar layout containing route configurations, bike profiles,
 * and detailed comparison or analytics panels.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  startCoord,
  endCoord,
  waypoints,
  onAddWaypoint,
  onRemoveWaypoint,
  onUpdateWaypoint,
  onReorderWaypoints,
  isPlacingStop,
  placingStopIndex,
  onStartPlacingStop,
  routeResult,
  routeVariants,
  routingStrategy,
  isFetchingOSM,
  onStrategyChange,
  onSwapCoords,
  rulesConfig,
  onRulesChange,
  bikeConfig,
  onBikeConfigChange,
  isNavigating,
  onStartNavigation,
  onStopNavigation,
  navigationProgress,
  onToggleCameraMode,
  cameraMode,
  isInspectorModeActive,
  selectedNodeId,
  onSelectNodeId,
  selectedAlternativeTargetId,
  setSelectedAlternativeTargetId,
  appMode,
  events,
  selectedEdgeIds,
  landmarks,
  places,
  onCreateEvent,
  onToggleEvent,
  onDeleteEvent,
  onClearSelection,
  onCreateLandmark,
  onCreatePlace,
  onUpdateLandmark,
  onUpdatePlace,
  onDeleteLandmark,
  onDeletePlace,
  onSetStartCoord,
  onSetEndCoord,
  isPlacingPlace: isPlacingPlaceProp,
  onPlacingPlaceChange: onPlacingPlaceChangeProp,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const mapInstance = useContext(MapInstanceContext);
  const routing = useContext(RoutingStateContext);
  const navigationCtx = useContext(NavigationStateContext);
  const studio = useContext(StudioStateContext);

  const currentAppMode = appMode ?? mapInstance?.appMode ?? 'routing';
  const currentStartCoord = startCoord ?? routing?.startCoord ?? null;
  const currentEndCoord = endCoord ?? routing?.endCoord ?? null;
  const currentRouteVariants = routeVariants ?? routing?.routeVariants ?? [];
  const currentRoutingStrategy = routingStrategy ?? routing?.activeAlternativeLabel ?? 'standard';
  const onStrategyChangeHandler = onStrategyChange ?? routing?.onSelectAlternative ?? (() => {});
  const currentIsInspectorModeActive =
    isInspectorModeActive ?? routing?.isInspectorModeActive ?? false;
  const currentSelectedNodeId = selectedNodeId ?? routing?.selectedNodeId ?? null;
  const onSelectNodeIdHandler = onSelectNodeId ?? routing?.setSelectedNodeId ?? (() => {});
  const currentSelectedAlternativeTargetId =
    selectedAlternativeTargetId ?? routing?.selectedAlternativeTargetId ?? null;
  const setSelectedAlternativeTargetIdHandler =
    setSelectedAlternativeTargetId ?? routing?.setSelectedAlternativeTargetId ?? (() => {});

  const currentEvents = events ?? studio?.events ?? [];
  const currentSelectedEdgeIds = selectedEdgeIds ?? studio?.selectedEdgeIds ?? [];
  const currentLandmarks = places ?? landmarks ?? studio?.places ?? [];
  const isPlacingPlace = isPlacingPlaceProp ?? studio?.isPlacingPlace ?? false;
  const onPlacingPlaceChange = onPlacingPlaceChangeProp ?? studio?.setIsPlacingPlace;

  const currentIsNavigating = isNavigating ?? navigationCtx?.isNavigating ?? false;
  const onStopNavigationHandler = onStopNavigation ?? navigationCtx?.onStopNavigation ?? (() => {});

  const handleCreateLandmark = (input: CreateLandmarkInput) => {
    const fn = onCreatePlace ?? onCreateLandmark ?? studio?.onCreatePlace;
    if (fn) {
      fn(input);
      return;
    }
    const created = createLandmarkDomain(input);
    studio?.setPlaces?.((prev) => [created, ...prev]);
  };

  const handleUpdateLandmark = (id: string, updates: UpdateLandmarkInput) => {
    const fn = onUpdatePlace ?? onUpdateLandmark ?? studio?.onUpdatePlace;
    if (fn) {
      fn(id, updates);
      return;
    }
    studio?.setPlaces?.((prev) =>
      prev.map((item) => (item.id === id ? updateLandmarkDomain(item, updates) : item)),
    );
  };

  const handleDeleteLandmark = (id: string) => {
    const fn = onDeletePlace ?? onDeleteLandmark ?? studio?.onDeletePlace;
    if (fn) {
      fn(id);
      return;
    }
    studio?.setPlaces?.((prev) => deleteLandmarkDomain(prev, id));
  };

  const handleSetStartCoord = (coord: Coordinate) => {
    if (onSetStartCoord) {
      onSetStartCoord(coord);
    } else {
      routing?.onStartDrag?.(coord);
    }
  };

  const handleSetEndCoord = (coord: Coordinate) => {
    if (onSetEndCoord) {
      onSetEndCoord(coord);
    } else {
      routing?.onEndDrag?.(coord);
    }
  };

  const handleCenterMap = (coord: Coordinate) => {
    if (mapInstance?.map) {
      mapInstance.map.easeTo({
        center: [coord.lng, coord.lat],
        zoom: 15,
      });
    }
  };

  const currentMapCenter: Coordinate | null = (() => {
    if (mapInstance?.map && typeof mapInstance.map.getCenter === 'function') {
      const c = mapInstance.map.getCenter();
      return { lat: c.lat, lng: c.lng };
    }
    return currentStartCoord ?? currentEndCoord ?? null;
  })();

  const handleSwapCoords = () => {
    if (onSwapCoords) {
      onSwapCoords();
      return;
    }
    if (currentStartCoord && currentEndCoord) {
      const prevStart = currentStartCoord;
      const prevEnd = currentEndCoord;
      handleSetStartCoord(prevEnd);
      handleSetEndCoord(prevStart);
    }
  };

  const handleCreateEvent = (name: string, description?: string) => {
    if (onCreateEvent) {
      onCreateEvent(name, description);
      return;
    }
    if (!studio) return;
    const newEvent: MapEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      description,
      active: true,
      edgeIds: [...studio.selectedEdgeIds],
      effect: {
        type: 'road_blockage',
        penaltySeconds: 30,
      },
      createdAt: Date.now(),
    };
    studio.setEvents((prev) => [...prev, newEvent]);
    studio.setSelectedEdgeIds([]);
  };

  const handleToggleEvent = (id: string) => {
    if (onToggleEvent) {
      onToggleEvent(id);
      return;
    }
    studio?.setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, active: !e.active } : e)));
  };

  const handleDeleteEvent = (id: string) => {
    if (onDeleteEvent) {
      onDeleteEvent(id);
      return;
    }
    studio?.setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClearSelection = () => {
    if (onClearSelection) {
      onClearSelection();
      return;
    }
    studio?.onClearSelection();
  };

  return (
    <>
      <aside className={`sidebar ciclista-glass-panel ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {currentAppMode === 'events' || (currentAppMode as string) === 'studio' ? (
            <>
              <ShieldAlert size={20} className="sidebar-header-icon" />
              <h2>Events</h2>
            </>
          ) : currentAppMode === 'edit' ? (
            <>
              <GitFork size={20} className="sidebar-header-icon" />
              <h2>Edit</h2>
            </>
          ) : currentAppMode === 'places' || (currentAppMode as string) === 'landmarks' ? (
            <>
              <Star size={20} className="sidebar-header-icon" />
              <h2>Places</h2>
            </>
          ) : (
            <>
              <Route size={20} className="sidebar-header-icon" />
              <h2>Routing</h2>
            </>
          )}
        </div>

        <div className="sidebar-content">
          {currentAppMode === 'events' || (currentAppMode as string) === 'studio' ? (
            <EventsPanel
              events={currentEvents}
              selectedEdgeCount={currentSelectedEdgeIds.length}
              onCreateEvent={handleCreateEvent}
              onToggleEvent={handleToggleEvent}
              onDeleteEvent={handleDeleteEvent}
              onClearSelection={handleClearSelection}
            />
          ) : currentAppMode === 'edit' ? (
            <CrossingEditPanel />
          ) : currentAppMode === 'places' || (currentAppMode as string) === 'landmarks' ? (
            <PlacesPanel
              places={currentLandmarks}
              onCreatePlace={handleCreateLandmark}
              onUpdatePlace={handleUpdateLandmark}
              onDeletePlace={handleDeleteLandmark}
              onSetStartCoord={handleSetStartCoord}
              onSetEndCoord={handleSetEndCoord}
              onCenterMap={handleCenterMap}
              currentMapCenter={currentMapCenter}
              startCoord={currentStartCoord}
              endCoord={currentEndCoord}
              isPlacingPlace={isPlacingPlace}
              onPlacingPlaceChange={onPlacingPlaceChange}
            />
          ) : (
            <>
              {/* Section 1 & 2b: Routing configuration inputs */}
              <RoutingConfigPanel
                startCoord={currentStartCoord}
                endCoord={currentEndCoord}
                waypoints={waypoints}
                onSwapCoords={handleSwapCoords}
                onSetStartCoord={handleSetStartCoord}
                onSetEndCoord={handleSetEndCoord}
                onAddWaypoint={onAddWaypoint}
                onRemoveWaypoint={onRemoveWaypoint}
                onUpdateWaypoint={onUpdateWaypoint}
                onReorderWaypoints={onReorderWaypoints}
                isPlacingStop={isPlacingStop}
                placingStopIndex={placingStopIndex}
                onStartPlacingStop={onStartPlacingStop}
                isFetchingOSM={isFetchingOSM}
                bikeConfig={bikeConfig}
                onBikeConfigChange={onBikeConfigChange}
              />

              {/* Section 2: Route Alternatives Selector & Stats */}
              <RouteStatsPanel
                routeVariants={currentRouteVariants}
                routingStrategy={currentRoutingStrategy}
                onStrategyChange={onStrategyChangeHandler}
                routeResult={routeResult}
                isNavigating={currentIsNavigating}
              />

              {/* Inspector Mode Details Panel */}
              {routeResult !== null && !currentIsNavigating && currentIsInspectorModeActive && (
                <InspectorPanel
                  selectedNodeId={currentSelectedNodeId}
                  nextNodeId={
                    currentSelectedNodeId
                      ? routeResult.pathNodeIds[
                          routeResult.pathNodeIds.indexOf(currentSelectedNodeId) + 1
                        ]
                      : undefined
                  }
                  onClose={() => onSelectNodeIdHandler(null)}
                  selectedAlternativeTargetId={currentSelectedAlternativeTargetId}
                  setSelectedAlternativeTargetId={setSelectedAlternativeTargetIdHandler}
                />
              )}

              {/* Navigation Control Panel */}
              {routeResult !== null && (
                <NavigationControlCard
                  isNavigating={currentIsNavigating}
                  onStartNavigation={onStartNavigation}
                  onStopNavigation={onStopNavigationHandler}
                  onToggleCameraMode={onToggleCameraMode}
                  cameraMode={cameraMode}
                  navigationProgress={navigationProgress}
                  onBeforeStartNavigation={() => setIsCollapsed(true)}
                />
              )}

              {/* Section 3: Road Rules Configuration */}
              <RulesConfigPanel config={rulesConfig} onChange={onRulesChange} />

              {/* Section 4: Route Comparison Panel */}
              <RouteComparePanel
                routeVariants={currentRouteVariants}
                activeAlternativeLabel={currentRoutingStrategy}
                onSelectAlternative={onStrategyChangeHandler}
              />

              <AttributionPanel />
            </>
          )}
        </div>

        <div className="sidebar-footer">
          {currentAppMode === 'events' || (currentAppMode as string) === 'studio' ? (
            <p>Click or drag brush on roads to select and configure blockages.</p>
          ) : currentAppMode === 'edit' ? (
            <p>Click junctions to configure turn paths or time stoplights.</p>
          ) : (
            <p>Drag green/red pins or right-click map to route.</p>
          )}
        </div>
      </aside>

      <button
        className={`sidebar-toggle-btn ${isCollapsed ? 'collapsed' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsCollapsed((prev) => !prev);
        }}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="desktop-icon">
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </span>
        <span className="mobile-icon">
          {isCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
    </>
  );
};
