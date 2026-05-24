import { ChevronDown, ChevronUp, RotateCcw, Settings } from 'lucide-react';
import React, { useState } from 'react';

import { DEFAULT_RULES_CONFIG } from '../core/router/rules';
import type {
  NodeDelayConfig,
  RoadRuleConfig,
  RulesConfiguration,
  SignRuleConfig,
} from '../core/router/types';
import { GermanSign, RoadType } from '../core/router/types';
import { IntersectionDelaySection } from './IntersectionDelaySection';
import { RoadRow, SignRow } from './RulesRows';

interface RulesConfigPanelProps {
  config: RulesConfiguration;
  onChange: (updated: RulesConfiguration) => void;
}

/**
 *
 */
export const RulesConfigPanel: React.FC<RulesConfigPanelProps> = ({ config, onChange }) => {
  const [signsOpen, setSignsOpen] = useState(false);
  const [roadsOpen, setRoadsOpen] = useState(false);
  const [intersectionsOpen, setIntersectionsOpen] = useState(false);

  const updateSign = (signId: GermanSign, updated: SignRuleConfig) => {
    onChange({
      ...config,
      signs: { ...config.signs, [signId]: updated },
    });
  };

  const updateRoad = (roadId: RoadType, updated: RoadRuleConfig) => {
    onChange({
      ...config,
      roads: { ...config.roads, [roadId]: updated },
    });
  };

  const updateNodeDelays = (updated: NodeDelayConfig) => {
    onChange({ ...config, nodeDelays: updated });
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(DEFAULT_RULES_CONFIG);
  };

  return (
    <section className="ciclista-card rules-panel">
      {/* Panel header */}
      <div className="rules-panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={15} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ margin: 0 }}>Road Rules</h2>
        </span>
        <button onClick={handleReset} title="Reset to defaults" className="rules-reset-btn">
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {/* German Traffic Signs sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setSignsOpen((v) => !v)}
          aria-expanded={signsOpen}
        >
          <span>🚦 Traffic Signs</span>
          {signsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {signsOpen && (
          <div className="rules-list">
            {Object.values(config.signs).map((sign) => (
              <SignRow
                key={sign.signId}
                config={sign}
                onChange={(updated) => updateSign(sign.signId, updated)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Road Classifications sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setRoadsOpen((v) => !v)}
          aria-expanded={roadsOpen}
        >
          <span>🛣️ Road Classes</span>
          {roadsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {roadsOpen && (
          <div className="rules-list">
            {Object.values(config.roads).map((road) => (
              <RoadRow
                key={road.roadId}
                config={road}
                onChange={(updated) => updateRoad(road.roadId, updated)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Intersection delays sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setIntersectionsOpen((v) => !v)}
          aria-expanded={intersectionsOpen}
        >
          <span>⏱️ Intersections</span>
          {intersectionsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {intersectionsOpen && (
          <IntersectionDelaySection config={config.nodeDelays} onChange={updateNodeDelays} />
        )}
      </div>
    </section>
  );
};
