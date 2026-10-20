import { Bike, ChevronDown, ChevronUp, Footprints, Home, Route } from 'lucide-react';
import React, { useState } from 'react';

import type { RoadRuleConfig, SignRuleConfig } from '../core/config';
import { getEffectiveRoadSpeedType, getEffectiveSignSpeedType } from '../core/rules';
import { SliderField } from './common/SliderField';
import { ComfortSelector, SpeedTypeSelector } from './RulesSelectorFields';

const getIcon = (iconCode: string): React.ReactNode => {
  switch (iconCode) {
    case '🚶':
      return <Footprints size={14} aria-label="Pedestrian Zone Icon" />;
    case '🦶':
      return <Footprints size={14} aria-label="Sidewalk Icon" />;
    case '🚶‍♂️🚲':
      return (
        <span className="strategy-label-badge">
          <Footprints size={10} aria-label="Pedestrian Icon" />
          <Bike size={10} aria-label="Bicycle Icon" />
        </span>
      );
    case '🚲':
      return <Bike size={14} aria-label="Bicycle Icon" />;
    case '🏘️':
      return <Home size={14} aria-label="Living Street Icon" />;
    case '🚲🛣️':
      return <Bike size={14} aria-label="Bicycle Street Icon" />;
    default:
      return iconCode;
  }
};

interface RuleRowProps<T extends SignRuleConfig | RoadRuleConfig> {
  icon: React.ReactNode;
  config: T;
  speedType: 'relative' | 'slow' | 'slower' | 'dismount' | 'custom';
  maxSpeedKmh: number;
  onChange: (updated: T) => void;
}

const RuleRow = <T extends SignRuleConfig | RoadRuleConfig>({
  icon,
  config,
  speedType,
  maxSpeedKmh,
  onChange,
}: RuleRowProps<T>) => {
  const [expanded, setExpanded] = useState(false);
  const description = 'description' in config ? config.description : undefined;

  return (
    <div className="rules-item">
      <button
        className="rules-item-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="rules-item-icon">{icon}</span>
        <span className="rules-item-name">{config.name}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="rules-item-body">
          {description && <p className="rules-item-desc">{description}</p>}

          <div className="ciclista-form-group--small">
            <label>Speed type</label>
            <SpeedTypeSelector
              value={speedType}
              onChange={(val) => onChange({ ...config, speedType: val })}
            />
          </div>

          {speedType === 'dismount' ? (
            <div className="ciclista-form-group--small mt-xs">
              <span className="rules-speed-info">
                Speed locked: <strong>4 km/h</strong> (Dismount / Walking speed)
              </span>
            </div>
          ) : (
            speedType === 'custom' && (
              <SliderField
                label="Base speed"
                value={config.baseSpeedKmh}
                min={1}
                max={maxSpeedKmh}
                step={1}
                unit=" km/h"
                onChange={(val) => onChange({ ...config, baseSpeedKmh: val })}
              />
            )
          )}

          <div className="ciclista-form-group--small mt-sm">
            <label>Comfort level</label>
            <ComfortSelector
              value={config.comfort || 'neutral'}
              onChange={(val) => onChange({ ...config, comfort: val })}
            />
          </div>

          <SliderField
            label="Avoidance time penalty"
            value={config.flatPenaltySeconds}
            min={0}
            max={120}
            step={5}
            unit="s"
            onChange={(val) => onChange({ ...config, flatPenaltySeconds: val })}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Properties for configuring sign rule options in SignRow.
 */
export interface SignRowProps {
  config: SignRuleConfig;
  onChange: (updated: SignRuleConfig) => void;
}

/**
 * Interactive row component representing configuration options for a specific infrastructure/traffic sign.
 * Allows toggling active speed profiles, custom speeds, comfort, and flat avoidance penalties.
 */
export const SignRow: React.FC<SignRowProps> = ({ config, onChange }) => {
  return (
    <RuleRow
      icon={getIcon(config.iconCode)}
      config={config}
      speedType={getEffectiveSignSpeedType(config)}
      maxSpeedKmh={30}
      onChange={onChange}
    />
  );
};

/**
 * Properties for configuring road rule options in RoadRow.
 */
export interface RoadRowProps {
  config: RoadRuleConfig;
  onChange: (updated: RoadRuleConfig) => void;
}

/**
 * Interactive row component representing configuration options for a specific road type.
 * Allows configuring speed modifiers, comfort rating, and route avoidance penalty values.
 */
export const RoadRow: React.FC<RoadRowProps> = ({ config, onChange }) => {
  return (
    <RuleRow
      icon={<Route size={14} aria-label="Road Icon" />}
      config={config}
      speedType={getEffectiveRoadSpeedType(config)}
      maxSpeedKmh={45}
      onChange={onChange}
    />
  );
};
