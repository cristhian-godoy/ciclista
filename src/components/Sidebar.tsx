import { Navigation } from 'lucide-react';
import React from 'react';

import type { Coordinate } from '../core/common/types';
import type { RouteAlternative, RouteResult, RulesConfiguration } from '../core/router/types';
import type { BikeProfile } from '../core/storage/types';
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
  bikeProfile: BikeProfile;
  onBikeProfileChange: (profile: BikeProfile) => void;
  theme: 'bright' | 'liberty' | 'dark';
  onThemeChange: (theme: 'bright' | 'liberty' | 'dark') => void;
}

/**
 *
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
  bikeProfile,
  onBikeProfileChange,
  theme,
  onThemeChange,
}) => {
  return (
    <aside className="sidebar">
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
          bikeProfile={bikeProfile}
          onBikeProfileChange={onBikeProfileChange}
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
  );
};
