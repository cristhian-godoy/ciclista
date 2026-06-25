import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  CornerUpRight,
  RefreshCw,
} from 'lucide-react';
import React, { useState } from 'react';

import type { TurnRuleConfig } from '../core/config';

interface TurnRowProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  max: number;
  description: string;
  onChange: (newValue: number) => void;
}

const TurnRow: React.FC<TurnRowProps> = ({ label, icon, value, max, description, onChange }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rules-item">
      <button
        className="rules-item-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="rules-item-icon">{icon}</span>
        <span className="rules-item-name">{label}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="rules-item-body">
          <p className="rules-item-desc">{description}</p>
          <div className="ciclista-form-group--small">
            <label>
              Penalty: <strong>{value}s</strong>
            </label>
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="ciclista-slider--small"
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface TurnDelaySectionProps {
  config: TurnRuleConfig;
  onChange: (updated: TurnRuleConfig) => void;
}

const TURN_FIELDS: {
  key: keyof TurnRuleConfig;
  label: string;
  icon: React.ReactNode;
  max: number;
  description: string;
}[] = [
  {
    key: 'leftTurnPenaltySeconds',
    label: 'Left Turn',
    icon: <ArrowLeft size={14} aria-label="Left Turn Icon" />,
    max: 60,
    description: 'Default delay penalty applied when performing a direct left turn.',
  },
  {
    key: 'rightTurnPenaltySeconds',
    label: 'Right Turn',
    icon: <ArrowRight size={14} aria-label="Right Turn Icon" />,
    max: 60,
    description: 'Default delay penalty applied when performing a right turn.',
  },
  {
    key: 'greenArrowRightTurnSeconds',
    label: 'Green Arrow Right Turn',
    icon: <CornerUpRight size={14} aria-label="Green Arrow Right Turn Icon" />,
    max: 60,
    description:
      'Custom penalty for a right turn permitted during red light (e.g. green arrow sign).',
  },
  {
    key: 'indirectLeftTurnSeconds',
    label: 'Indirect Left Turn',
    icon: <CornerDownLeft size={14} aria-label="Indirect Left Turn Icon" />,
    max: 120,
    description: 'Custom penalty for an indirect (box / Copenhagen) two-stage left turn.',
  },
  {
    key: 'uTurnPenaltySeconds',
    label: 'U-Turn',
    icon: <RefreshCw size={14} aria-label="U-Turn Icon" />,
    max: 120,
    description: 'Default delay penalty applied when performing a U-turn.',
  },
];

/**
 *
 */
export const TurnDelaySection: React.FC<TurnDelaySectionProps> = ({ config, onChange }) => (
  <div className="rules-list">
    {TURN_FIELDS.map(({ key, label, icon, max, description }) => (
      <TurnRow
        key={key}
        label={label}
        icon={icon}
        value={config[key]}
        max={max}
        description={description}
        onChange={(newValue) => onChange({ ...config, [key]: newValue })}
      />
    ))}
  </div>
);
