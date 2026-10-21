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
import { AccordionSection } from './common/AccordionSection';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CornerUpRight,
  RotateCcw,
  Route,
  Settings,
  TrafficCone,
} from './common/Icon';
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
          <AccordionSection
            title="Traffic Signs"
            icon={<TrafficCone size={13} aria-label="Traffic Signs Icon" />}
            isOpen={signsOpen}
            onToggle={setSignsOpen}
            bodyClassName="rules-list"
          >
            {Object.values(config.signs).map((sign) => (
              <SignRow
                key={sign.signId}
                config={sign}
                onChange={(updated) => updateSign(sign.signId, updated)}
              />
            ))}
          </AccordionSection>

          {/* Road Classifications sub-section */}
          <AccordionSection
            title="Road Classes"
            icon={<Route size={13} aria-label="Road Classes Icon" />}
            isOpen={roadsOpen}
            onToggle={setRoadsOpen}
            bodyClassName="rules-list"
          >
            {Object.values(config.roads).map((road) => (
              <RoadRow
                key={road.roadId}
                config={road}
                onChange={(updated) => updateRoad(road.roadId, updated)}
              />
            ))}
          </AccordionSection>

          {/* Intersection delays sub-section */}
          <AccordionSection
            title="Intersections"
            icon={<Clock size={13} aria-label="Intersections Icon" />}
            isOpen={intersectionsOpen}
            onToggle={setIntersectionsOpen}
          >
            <IntersectionDelaySection config={config.nodeDelays} onChange={updateNodeDelays} />
          </AccordionSection>

          {/* Turn Penalties sub-section */}
          <AccordionSection
            title="Turn Penalties"
            icon={<CornerUpRight size={13} aria-label="Turns Icon" />}
            isOpen={turnsOpen}
            onToggle={setTurnsOpen}
          >
            <TurnDelaySection config={config.turns} onChange={updateTurns} />
          </AccordionSection>
        </div>
      </details>
    </section>
  );
};
