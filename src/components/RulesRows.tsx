import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';

import type { RoadRuleConfig, SignRuleConfig } from '../core/router/types';
import { GermanSign } from '../core/router/types';
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

  const getEffectiveSpeedType = (
    cfg: SignRuleConfig,
  ): 'relative' | 'slow' | 'slower' | 'dismount' | 'custom' => {
    if (cfg.speedType) return cfg.speedType;
    const signId = cfg.signId;
    if (
      signId === GermanSign.VZ_241 ||
      signId === GermanSign.VZ_244_1 ||
      signId === GermanSign.VZ_325_1
    ) {
      return 'relative';
    }
    if (signId === GermanSign.VZ_242_1 || signId === GermanSign.VZ_239) {
      return 'dismount';
    }
    return 'custom';
  };

  const speedType = getEffectiveSpeedType(config);

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

          <div className="rules-field">
            <label>Speed type</label>
            <SpeedTypeSelector
              value={speedType}
              onChange={(val) => onChange({ ...config, speedType: val })}
            />
          </div>

          {speedType === 'dismount' ? (
            <div className="rules-field" style={{ marginTop: '4px' }}>
              <span
                className="rules-speed-info"
                style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
              >
                Speed locked: <strong>4 km/h</strong> (Dismount / Walking speed)
              </span>
            </div>
          ) : (
            speedType === 'custom' && (
              <div className="rules-field">
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
                  className="rules-slider"
                />
              </div>
            )
          )}

          <div className="rules-field" style={{ marginTop: '8px' }}>
            <label>Comfort level</label>
            <ComfortSelector
              value={config.comfort || 'neutral'}
              onChange={(val) => onChange({ ...config, comfort: val })}
            />
          </div>

          <div className="rules-field">
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
              className="rules-slider"
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

  const getEffectiveSpeedType = (
    cfg: RoadRuleConfig,
  ): 'relative' | 'slow' | 'slower' | 'dismount' | 'custom' => {
    if (cfg.speedType) return cfg.speedType;
    return 'custom';
  };

  const speedType = getEffectiveSpeedType(config);

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
          <div className="rules-field">
            <label>Speed type</label>
            <SpeedTypeSelector
              value={speedType}
              onChange={(val) => onChange({ ...config, speedType: val })}
            />
          </div>

          {speedType === 'dismount' ? (
            <div className="rules-field" style={{ marginTop: '4px' }}>
              <span
                className="rules-speed-info"
                style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
              >
                Speed locked: <strong>4 km/h</strong> (Dismount / Walking speed)
              </span>
            </div>
          ) : (
            speedType === 'custom' && (
              <div className="rules-field">
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
                  className="rules-slider"
                />
              </div>
            )
          )}

          <div className="rules-field" style={{ marginTop: '8px' }}>
            <label>Comfort level</label>
            <ComfortSelector
              value={config.comfort || 'neutral'}
              onChange={(val) => onChange({ ...config, comfort: val })}
            />
          </div>

          <div className="rules-field">
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
              className="rules-slider"
            />
          </div>
        </div>
      )}
    </div>
  );
};
