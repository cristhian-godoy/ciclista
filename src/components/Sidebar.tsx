import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Navigation } from 'lucide-react';
import React, { useState } from 'react';

import type { Coordinate } from '../core/common/types';
import type { RouteAlternative, RouteResult, RulesConfiguration } from '../core/router/types';
import type { BikeConfig } from '../core/storage/types';
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

          {/* Section 2: Route Alternatives Selector & Stats */}
          <RouteStatsPanel
            routeAlternatives={routeAlternatives}
            routingStrategy={routingStrategy}
            onStrategyChange={onStrategyChange}
            routeResult={routeResult}
          />

          {/* Section 3: Road Rules Configuration */}
          <RulesConfigPanel config={rulesConfig} onChange={onRulesChange} />

          {/* Section 4: Route Comparison Panel */}
          <RouteComparePanel
            routeAlternatives={routeAlternatives}
            activeAlternativeLabel={routingStrategy}
            onSelectAlternative={onStrategyChange}
          />
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
