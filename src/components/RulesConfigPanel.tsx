import {
  ChevronDown,
  ChevronUp,
  Clock,
  CornerUpRight,
  RotateCcw,
  Route,
  Settings,
  TrafficCone,
} from 'lucide-react';
import React, { useState } from 'react';

import {
  DEFAULT_RULES_CONFIG,
  InfrastructureType,
  type NodeDelayConfig,
  type RoadRuleConfig,
  RoadType,
  type RulesConfiguration,
  type SignRuleConfig,
  type TurnRuleConfig,
} from '../core/config';
import { IntersectionDelaySection } from './IntersectionDelaySection';
import { RoadRow, SignRow } from './RulesRows';
import { TurnDelaySection } from './TurnDelaySection';

interface RulesConfigPanelProps {
  config: RulesConfiguration;
  onChange: (updated: RulesConfiguration) => void;
}

/**
 * Collapsible rules configuration panel for setting custom speeds, weight modifiers,
 * and wait-time penalties across various road types and infrastructure elements.
 */
export const RulesConfigPanel: React.FC<RulesConfigPanelProps> = ({ config, onChange }) => {
  const [signsOpen, setSignsOpen] = useState(false);
  const [roadsOpen, setRoadsOpen] = useState(false);
  const [intersectionsOpen, setIntersectionsOpen] = useState(false);
  const [turnsOpen, setTurnsOpen] = useState(false);

  const updateSign = (signId: InfrastructureType, updated: SignRuleConfig) => {
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

  const updateTurns = (updated: TurnRuleConfig) => {
    onChange({ ...config, turns: updated });
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <TrafficCone size={13} aria-label="Traffic Signs Icon" />
            Traffic Signs
          </span>
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Route size={13} aria-label="Road Classes Icon" />
            Road Classes
          </span>
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} aria-label="Intersections Icon" />
            Intersections
          </span>
          {intersectionsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {intersectionsOpen && (
          <IntersectionDelaySection config={config.nodeDelays} onChange={updateNodeDelays} />
        )}
      </div>

      {/* Turn Penalties sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setTurnsOpen((v) => !v)}
          aria-expanded={turnsOpen}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CornerUpRight size={13} aria-label="Turns Icon" />
            Turn Penalties
          </span>
          {turnsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {turnsOpen && <TurnDelaySection config={config.turns} onChange={updateTurns} />}
      </div>
    </section>
  );
};
