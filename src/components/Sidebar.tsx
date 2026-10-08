import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Navigation2,
  Play,
  Route,
  ShieldAlert,
  Square,
  Star,
} from 'lucide-react';
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
import { EventsPanel } from './EventsPanel';
import { InspectorPanel } from './InspectorPanel';
import { MapContext } from './map/MapContext';
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
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeResult: RouteResult | null;
  routeVariants: StrategyRouteVariant[];
  routingStrategy: 'standard' | 'avoid-stops' | 'quiet-streets';
  isFetchingOSM: boolean;
  onStrategyChange: (strategy: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  onPresetChange: (presetName: 'munich' | 'amsterdam') => void;
  rulesConfig: RulesConfiguration;
  onRulesChange: (config: RulesConfiguration) => void;
  bikeConfig: BikeConfig;
  onBikeConfigChange: (config: BikeConfig) => void;
  isNavigating: boolean;
  onStartNavigation: () => void;
  onStopNavigation: () => void;
  navigationProgress: NavigationProgress | null;
  onToggleCameraMode: () => void;
  cameraMode: CameraMode;
  isInspectorModeActive: boolean;
  selectedNodeId: string | null;
  onSelectNodeId: (id: string | null) => void;
  selectedAlternativeTargetId: string | null;
  setSelectedAlternativeTargetId: (id: string | null) => void;
  /**
   * Active application workflow mode ('routing', 'landmarks', or 'studio').
   */
  appMode?: ToolbarMode;
  /**
   * Current list of studio map events.
   */
  events?: MapEvent[];
  /**
   * Currently selected road segment IDs.
   */
  selectedEdgeIds?: string[];
  /**
   * Current list of favorite places and landmarks.
   */
  landmarks?: Landmark[];
  /**
   * Alias for landmarks collection.
   */
  places?: Landmark[];
  /**
   * Callback fired when creating a new event in Studio mode.
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
   */
  onCreateLandmark?: (input: CreateLandmarkInput) => void;
  /**
   * Callback fired when creating a new place.
   */
  onCreatePlace?: (input: CreateLandmarkInput) => void;
  /**
   * Callback fired when modifying a landmark or place.
   */
  onUpdateLandmark?: (id: string, updates: UpdateLandmarkInput) => void;
  /**
   * Callback fired when modifying a place.
   */
  onUpdatePlace?: (id: string, updates: UpdateLandmarkInput) => void;
  /**
   * Callback fired when deleting a landmark or place.
   */
  onDeleteLandmark?: (id: string) => void;
  /**
   * Callback fired when deleting a place.
   */
  onDeletePlace?: (id: string) => void;
  /**
   * Callback fired when setting start route pin from a landmark.
   */
  onSetStartCoord?: (coord: Coordinate) => void;
  /**
   * Callback fired when setting end route pin from a landmark.
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
}

/**
 * Main dashboard sidebar layout containing route configurations, bike profiles,
 * and detailed comparison or analytics panels.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  startCoord,
  endCoord,
  routeResult,
  routeVariants,
  routingStrategy,
  isFetchingOSM,
  onStrategyChange,
  selectedPreset,
  onPresetChange,
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
  // Collapse state determines sidebar visibility and adjusts toggle button alignment.
  const [isCollapsed, setIsCollapsed] = useState(false);

  const mapCtx = useContext(MapContext);
  const currentAppMode = appMode ?? mapCtx?.appMode ?? 'routing';
  const currentEvents = events ?? mapCtx?.events ?? [];
  const currentSelectedEdgeIds = selectedEdgeIds ?? mapCtx?.selectedEdgeIds ?? [];
  const currentLandmarks = places ?? landmarks ?? mapCtx?.places ?? mapCtx?.landmarks ?? [];
  const isPlacingPlace = isPlacingPlaceProp ?? mapCtx?.isPlacingPlace;
  const onPlacingPlaceChange = onPlacingPlaceChangeProp ?? mapCtx?.setIsPlacingPlace;

  const handleCreateLandmark = (input: CreateLandmarkInput) => {
    const fn = onCreatePlace ?? onCreateLandmark;
    if (fn) {
      fn(input);
      return;
    }
    const created = createLandmarkDomain(input);
    mapCtx?.setLandmarks((prev) => [created, ...prev]);
  };

  const handleUpdateLandmark = (id: string, updates: UpdateLandmarkInput) => {
    const fn = onUpdatePlace ?? onUpdateLandmark;
    if (fn) {
      fn(id, updates);
      return;
    }
    mapCtx?.setLandmarks((prev) =>
      prev.map((item) => (item.id === id ? updateLandmarkDomain(item, updates) : item)),
    );
  };

  const handleDeleteLandmark = (id: string) => {
    const fn = onDeletePlace ?? onDeleteLandmark;
    if (fn) {
      fn(id);
      return;
    }
    mapCtx?.setLandmarks((prev) => deleteLandmarkDomain(prev, id));
  };

  const handleSetStartCoord = (coord: Coordinate) => {
    if (onSetStartCoord) {
      onSetStartCoord(coord);
    } else {
      mapCtx?.onStartDrag(coord);
    }
  };

  const handleSetEndCoord = (coord: Coordinate) => {
    if (onSetEndCoord) {
      onSetEndCoord(coord);
    } else {
      mapCtx?.onEndDrag(coord);
    }
  };

  const handleCenterMap = (coord: Coordinate) => {
    if (mapCtx?.map) {
      mapCtx.map.easeTo({
        center: [coord.lng, coord.lat],
        zoom: 15,
      });
    }
  };

  const currentMapCenter: Coordinate | null = (() => {
    if (mapCtx?.map && typeof mapCtx.map.getCenter === 'function') {
      const c = mapCtx.map.getCenter();
      return { lat: c.lat, lng: c.lng };
    }
    return startCoord ?? endCoord ?? null;
  })();

  const handleCreateEvent = (name: string, description?: string) => {
    if (onCreateEvent) {
      onCreateEvent(name, description);
      return;
    }
    if (!mapCtx) return;
    const newEvent: MapEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      description,
      active: true,
      edgeIds: [...mapCtx.selectedEdgeIds],
      effect: {
        type: 'road_blockage',
        penaltySeconds: 30,
      },
      createdAt: Date.now(),
    };
    mapCtx.setEvents((prev) => [...prev, newEvent]);
    mapCtx.setSelectedEdgeIds([]);
  };

  const handleToggleEvent = (id: string) => {
    if (onToggleEvent) {
      onToggleEvent(id);
      return;
    }
    mapCtx?.setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, active: !e.active } : e)));
  };

  const handleDeleteEvent = (id: string) => {
    if (onDeleteEvent) {
      onDeleteEvent(id);
      return;
    }
    mapCtx?.setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClearSelection = () => {
    if (onClearSelection) {
      onClearSelection();
      return;
    }
    mapCtx?.onClearSelection();
  };

  return (
    <>
      <aside className={`sidebar ciclista-glass-panel ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {currentAppMode === 'studio' ? (
            <>
              <ShieldAlert size={20} className="sidebar-header-icon" />
              <h2>Events</h2>
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
          {currentAppMode === 'studio' ? (
            <EventsPanel
              events={currentEvents}
              selectedEdgeCount={currentSelectedEdgeIds.length}
              onCreateEvent={handleCreateEvent}
              onToggleEvent={handleToggleEvent}
              onDeleteEvent={handleDeleteEvent}
              onClearSelection={handleClearSelection}
            />
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
              startCoord={startCoord}
              endCoord={endCoord}
              isPlacingPlace={isPlacingPlace}
              onPlacingPlaceChange={onPlacingPlaceChange}
            />
          ) : (
            <>
              {/* Section 1 & 2b: Routing configuration inputs */}
              <RoutingConfigPanel
                selectedPreset={selectedPreset}
                onPresetChange={onPresetChange}
                isFetchingOSM={isFetchingOSM}
                bikeConfig={bikeConfig}
                onBikeConfigChange={onBikeConfigChange}
              />

              {/* Section 2: Route Alternatives Selector & Stats */}
              <RouteStatsPanel
                routeVariants={routeVariants}
                routingStrategy={routingStrategy}
                onStrategyChange={onStrategyChange}
                routeResult={routeResult}
                isNavigating={isNavigating}
              />

              {/* Inspector Mode Details Panel */}
              {routeResult !== null && !isNavigating && isInspectorModeActive && (
                <InspectorPanel
                  selectedNodeId={selectedNodeId}
                  nextNodeId={
                    selectedNodeId
                      ? routeResult.pathNodeIds[routeResult.pathNodeIds.indexOf(selectedNodeId) + 1]
                      : undefined
                  }
                  onClose={() => onSelectNodeId(null)}
                  selectedAlternativeTargetId={selectedAlternativeTargetId}
                  setSelectedAlternativeTargetId={setSelectedAlternativeTargetId}
                />
              )}

              {/* Navigation Control Panel */}
              {routeResult !== null && (
                <div className="ciclista-card sidebar-nav-card">
                  {!isNavigating ? (
                    <button
                      className="ciclista-btn ciclista-btn--primary sidebar-nav-btn"
                      onClick={() => {
                        setIsCollapsed(true);
                        onStartNavigation();
                      }}
                    >
                      <Play size={16} />
                      Start Navigation
                    </button>
                  ) : (
                    <div className="sidebar-active-nav">
                      <div className="sidebar-active-row">
                        <span className="sidebar-active-title">Active Navigation</span>
                        <div className="sidebar-actions-group">
                          <button
                            className="ciclista-btn ciclista-btn--secondary sidebar-icon-btn"
                            onClick={onToggleCameraMode}
                            title={`Toggle camera mode (current: ${cameraMode})`}
                          >
                            {cameraMode === 'north-up' ? (
                              <Compass size={16} />
                            ) : (
                              <Navigation2 size={16} />
                            )}
                          </button>
                          <button
                            className="ciclista-btn ciclista-btn--danger sidebar-icon-btn"
                            onClick={onStopNavigation}
                            title="Stop Navigation"
                          >
                            <Square size={16} />
                          </button>
                        </div>
                      </div>
                      {navigationProgress && (
                        <div className="sidebar-nav-grid">
                          <div>
                            <div className="sidebar-nav-lbl">Remaining</div>
                            <div className="sidebar-nav-val">
                              {navigationProgress.distanceRemainingM >= 1000
                                ? `${(navigationProgress.distanceRemainingM / 1000).toFixed(1)} km`
                                : `${Math.round(navigationProgress.distanceRemainingM)} m`}
                            </div>
                          </div>
                          <div>
                            <div className="sidebar-nav-lbl">ETA</div>
                            <div className="sidebar-nav-val">
                              {Math.floor(navigationProgress.etaSeconds / 60) > 0
                                ? `${Math.floor(navigationProgress.etaSeconds / 60)}m ${Math.round(navigationProgress.etaSeconds % 60)}s`
                                : `${Math.round(navigationProgress.etaSeconds)}s`}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: Road Rules Configuration */}
              <RulesConfigPanel config={rulesConfig} onChange={onRulesChange} />

              {/* Section 4: Route Comparison Panel */}
              <RouteComparePanel
                routeVariants={routeVariants}
                activeAlternativeLabel={routingStrategy}
                onSelectAlternative={onStrategyChange}
              />

              <AttributionPanel />
            </>
          )}
        </div>

        <div className="sidebar-footer">
          {currentAppMode === 'studio' ? (
            <p>Click or drag brush on roads to select and configure blockages.</p>
          ) : (
            <>
              <p>Drag green/red pins or right-click map to route.</p>
              <p className="sidebar-footer-note">Click red nodes to time stoplights.</p>
            </>
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
