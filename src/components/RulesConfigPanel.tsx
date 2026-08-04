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
  defaultOpen?: boolean;
}

/**
 * Collapsible rules configuration panel for setting custom speeds, weight modifiers,
 * and wait-time penalties across various road types and infrastructure elements.
 */
export const RulesConfigPanel: React.FC<RulesConfigPanelProps> = ({
  config,
  onChange,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
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
      <details
        open={isOpen}
        onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
        className="rules-details"
      >
        <summary className="rules-summary rules-summary-content">
          <div className="rules-panel-header rules-panel-header-box">
            <span className="rules-panel-title-group">
              <Settings size={15} className="rules-panel-title-icon" />
              <h2 className="ciclista-title">Road Rules</h2>
            </span>
            <div className="rules-panel-header-actions">
              <button onClick={handleReset} title="Reset to defaults" className="rules-reset-btn">
                <RotateCcw size={11} />
                Reset
              </button>
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>
        </summary>

        <div className="rules-body-container">
          {/* German Traffic Signs sub-section */}
          <div className="rules-section">
            <button
              className="rules-section-toggle"
              onClick={() => setSignsOpen((v) => !v)}
              aria-expanded={signsOpen}
            >
              <span className="rules-section-btn-label">
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
              <span className="rules-section-btn-label">
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
              <span className="rules-section-btn-label">
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
              <span className="rules-section-btn-label">
                <CornerUpRight size={13} aria-label="Turns Icon" />
                Turn Penalties
              </span>
              {turnsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {turnsOpen && <TurnDelaySection config={config.turns} onChange={updateTurns} />}
          </div>
        </div>
      </details>
    </section>
  );
};
