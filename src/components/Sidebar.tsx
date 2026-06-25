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
import type { CameraMode, NavigationProgress } from '../core/navigation/types';
import type { RouteAlternative, RouteResult, RulesConfiguration } from '../core/router/types';
import type { BikeConfig } from '../core/storage/types';
import { AttributionPanel } from './AttributionPanel';
import { DataSaverPanel } from './DataSaverPanel';
import { InspectorPanel } from './InspectorPanel';
import { RouteComparePanel } from './RouteComparePanel';
import { RouteStatsPanel } from './RouteStatsPanel';
import { RoutingConfigPanel } from './RoutingConfigPanel';
import { RulesConfigPanel } from './RulesConfigPanel';

interface SidebarProps {
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeResult: RouteResult | null;
  routeAlternatives: RouteAlternative[];
  routingStrategy: 'standard' | 'avoid-stops' | 'quiet-streets';
  isFetchingOSM: boolean;
  onStrategyChange: (strategy: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  onPresetChange: (presetName: 'munich' | 'amsterdam') => void;
  rulesConfig: RulesConfiguration;
  onRulesChange: (config: RulesConfiguration) => void;
  bikeConfig: BikeConfig;
  onBikeConfigChange: (config: BikeConfig) => void;
  theme: 'bright' | 'liberty' | 'dark';
  onThemeChange: (theme: 'bright' | 'liberty' | 'dark') => void;
  isNavigating: boolean;
  onStartNavigation: () => void;
  onStopNavigation: () => void;
  navigationProgress: NavigationProgress | null;
  onToggleCameraMode: () => void;
  cameraMode: CameraMode;
  isInspectorModeActive: boolean;
  selectedNodeId: string | null;
  onToggleInspectorMode: () => void;
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
  routeAlternatives,
  routingStrategy,
  isFetchingOSM,
  onStrategyChange,
  selectedPreset,
  onPresetChange,
  rulesConfig,
  onRulesChange,
  bikeConfig,
  onBikeConfigChange,
  theme,
  onThemeChange,
  isNavigating,
  onStartNavigation,
  onStopNavigation,
  navigationProgress,
  onToggleCameraMode,
  cameraMode,
  isInspectorModeActive,
  selectedNodeId,
  onToggleInspectorMode,
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
          <Navigation
            size={24}
            className="color-primary"
            style={{ color: 'var(--accent-primary)' }}
          />
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
            theme={theme}
            onThemeChange={onThemeChange}
          />

          <DataSaverPanel />

          {/* Section 2: Route Alternatives Selector & Stats */}
          <RouteStatsPanel
            routeAlternatives={routeAlternatives}
            routingStrategy={routingStrategy}
            onStrategyChange={onStrategyChange}
            routeResult={routeResult}
            isNavigating={isNavigating}
          />

          {/* Inspector Mode Toggle and Details Panel */}
          {routeResult !== null && !isNavigating && (
            <>
              <div className="ciclista-card" style={{ marginTop: '16px', padding: '16px' }}>
                <button
                  className={`ciclista-btn ${
                    isInspectorModeActive ? 'ciclista-btn--primary' : 'ciclista-btn--secondary'
                  }`}
                  onClick={onToggleInspectorMode}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>🔍</span>
                  {isInspectorModeActive ? 'Deactivate Inspector' : 'Activate Inspector'}
                </button>
              </div>

              {isInspectorModeActive && (
                <InspectorPanel
                  selectedNodeId={selectedNodeId}
                  evaluations={
                    selectedNodeId ? routeResult.alternativeEvaluations?.[selectedNodeId] || [] : []
                  }
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
            </>
          )}

          {/* Navigation Control Panel */}
          {routeResult !== null && (
            <div className="ciclista-card" style={{ marginTop: '16px', padding: '16px' }}>
              {!isNavigating ? (
                <button
                  className="ciclista-btn ciclista-btn--primary"
                  onClick={() => {
                    setIsCollapsed(true);
                    onStartNavigation();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Play size={16} />
                  Start Navigation
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Active Navigation</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="ciclista-btn ciclista-btn--secondary"
                        onClick={onToggleCameraMode}
                        title={`Toggle camera mode (current: ${cameraMode})`}
                        style={{ padding: '6px 10px' }}
                      >
                        {cameraMode === 'north-up' ? (
                          <Compass size={16} />
                        ) : (
                          <Navigation2 size={16} />
                        )}
                      </button>
                      <button
                        className="ciclista-btn ciclista-btn--danger"
                        onClick={onStopNavigation}
                        style={{ padding: '6px 10px' }}
                        title="Stop Navigation"
                      >
                        <Square size={16} />
                      </button>
                    </div>
                  </div>
                  {navigationProgress && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        opacity: 0.9,
                      }}
                    >
                      <div>
                        <div
                          style={{ fontSize: '11px', color: 'var(--ciclista-color-text-muted)' }}
                        >
                          Remaining
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          {navigationProgress.distanceRemainingM >= 1000
                            ? `${(navigationProgress.distanceRemainingM / 1000).toFixed(1)} km`
                            : `${Math.round(navigationProgress.distanceRemainingM)} m`}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{ fontSize: '11px', color: 'var(--ciclista-color-text-muted)' }}
                        >
                          ETA
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
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
            routeAlternatives={routeAlternatives}
            activeAlternativeLabel={routingStrategy}
            onSelectAlternative={onStrategyChange}
          />

          <AttributionPanel />
        </div>

        <div className="sidebar-footer">
          <p>Drag green/red pins or right-click map to route.</p>
          <p style={{ marginTop: '4px' }}>Click red nodes to time stoplights.</p>
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
