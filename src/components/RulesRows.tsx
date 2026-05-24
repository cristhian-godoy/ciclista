import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';

import { getEffectiveRoadSpeedType, getEffectiveSignSpeedType } from '../core/router/rules';
import type { RoadRuleConfig, SignRuleConfig } from '../core/router/types';
import { ComfortSelector, SpeedTypeSelector } from './RulesSelectorFields';

interface SignRowProps {
  config: SignRuleConfig;
  onChange: (updated: SignRuleConfig) => void;
}

/**
 *
 */
export const SignRow: React.FC<SignRowProps> = ({ config, onChange }) => {
  const [expanded, setExpanded] = useState(false);

  const speedType = getEffectiveSignSpeedType(config);

  return (
    <div className="rules-item">
      <button
        className="rules-item-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="rules-item-icon">{config.iconCode}</span>
        <span className="rules-item-name">{config.name}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="rules-item-body">
          <p className="rules-item-desc">{config.description}</p>

          <div className="ciclista-form-group--small">
            <label>Speed type</label>
            <SpeedTypeSelector
              value={speedType}
              onChange={(val) => onChange({ ...config, speedType: val })}
            />
          </div>

          {speedType === 'dismount' ? (
            <div className="ciclista-form-group--small" style={{ marginTop: '4px' }}>
              <span
                className="rules-speed-info"
                style={{ fontSize: '0.75rem', color: 'var(--ciclista-color-text-secondary)' }}
              >
                Speed locked: <strong>4 km/h</strong> (Dismount / Walking speed)
              </span>
            </div>
          ) : (
            speedType === 'custom' && (
              <div className="ciclista-form-group--small">
                <label>
                  Base speed: <strong>{config.baseSpeedKmh} km/h</strong>
                </label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={config.baseSpeedKmh}
                  onChange={(e) => onChange({ ...config, baseSpeedKmh: Number(e.target.value) })}
                  className="ciclista-slider--small"
                />
              </div>
            )
          )}

          <div className="ciclista-form-group--small" style={{ marginTop: '8px' }}>
            <label>Comfort level</label>
            <ComfortSelector
              value={config.comfort || 'neutral'}
              onChange={(val) => onChange({ ...config, comfort: val })}
            />
          </div>

          <div className="ciclista-form-group--small">
            <label>
              Avoidance time penalty: <strong>{config.flatPenaltySeconds}s</strong>
            </label>
            <input
              type="range"
              min={0}
              max={120}
              step={5}
              value={config.flatPenaltySeconds}
              onChange={(e) => onChange({ ...config, flatPenaltySeconds: Number(e.target.value) })}
              className="ciclista-slider--small"
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface RoadRowProps {
  config: RoadRuleConfig;
  onChange: (updated: RoadRuleConfig) => void;
}

/**
 *
 */
export const RoadRow: React.FC<RoadRowProps> = ({ config, onChange }) => {
  const [expanded, setExpanded] = useState(false);

  const speedType = getEffectiveRoadSpeedType(config);

  return (
    <div className="rules-item">
      <button
        className="rules-item-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="rules-item-icon">🛣️</span>
        <span className="rules-item-name">{config.name}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="rules-item-body">
          <div className="ciclista-form-group--small">
            <label>Speed type</label>
            <SpeedTypeSelector
              value={speedType}
              onChange={(val) => onChange({ ...config, speedType: val })}
            />
          </div>

          {speedType === 'dismount' ? (
            <div className="ciclista-form-group--small" style={{ marginTop: '4px' }}>
              <span
                className="rules-speed-info"
                style={{ fontSize: '0.75rem', color: 'var(--ciclista-color-text-secondary)' }}
              >
                Speed locked: <strong>4 km/h</strong> (Dismount / Walking speed)
              </span>
            </div>
          ) : (
            speedType === 'custom' && (
              <div className="ciclista-form-group--small">
                <label>
                  Base speed: <strong>{config.baseSpeedKmh} km/h</strong>
                </label>
                <input
                  type="range"
                  min={1}
                  max={45}
                  step={1}
                  value={config.baseSpeedKmh}
                  onChange={(e) => onChange({ ...config, baseSpeedKmh: Number(e.target.value) })}
                  className="ciclista-slider--small"
                />
              </div>
            )
          )}

          <div className="ciclista-form-group--small" style={{ marginTop: '8px' }}>
            <label>Comfort level</label>
            <ComfortSelector
              value={config.comfort || 'neutral'}
              onChange={(val) => onChange({ ...config, comfort: val })}
            />
          </div>

          <div className="ciclista-form-group--small">
            <label>
              Avoidance time penalty: <strong>{config.flatPenaltySeconds}s</strong>
            </label>
            <input
              type="range"
              min={0}
              max={120}
              step={5}
              value={config.flatPenaltySeconds}
              onChange={(e) => onChange({ ...config, flatPenaltySeconds: Number(e.target.value) })}
              className="ciclista-slider--small"
            />
          </div>
        </div>
      )}
    </div>
  );
};
