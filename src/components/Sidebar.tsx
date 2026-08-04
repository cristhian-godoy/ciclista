import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Navigation,
  Navigation2,
  Play,
  Square,
} from 'lucide-react';
import React, { useState } from 'react';

import type { Coordinate } from '../core/common/types';
import type { BikeConfig, RulesConfiguration } from '../core/config';
import type { CameraMode, NavigationProgress } from '../core/navigation/types';
import type { RouteResult, StrategyRouteVariant } from '../core/router/types';
import { AttributionPanel } from './AttributionPanel';
import { InspectorPanel } from './InspectorPanel';
import { RouteComparePanel } from './RouteComparePanel';
import { RouteStatsPanel } from './RouteStatsPanel';
import { RoutingConfigPanel } from './RoutingConfigPanel';
import { RulesConfigPanel } from './RulesConfigPanel';

interface SidebarProps {
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
}

/**
 * Main dashboard sidebar layout containing route configurations, bike profiles,
 * and detailed comparison or analytics panels.
 */
export const Sidebar: React.FC<SidebarProps> = ({
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
}) => {
  // Collapse state determines sidebar visibility and adjusts toggle button alignment.
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      <aside className={`sidebar ciclista-glass-panel ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <Navigation size={24} className="sidebar-brand-icon" />
          <h1>Ciclista</h1>
        </div>

        <div className="sidebar-content">
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
        </div>

        <div className="sidebar-footer">
          <p>Drag green/red pins or right-click map to route.</p>
          <p className="sidebar-footer-note">Click red nodes to time stoplights.</p>
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
