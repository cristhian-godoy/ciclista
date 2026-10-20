import { ArrowLeft, ArrowRight, CornerDownLeft, CornerUpRight, RefreshCw } from 'lucide-react';
import React from 'react';

import type { TurnRuleConfig } from '../core/config';
import { DelayRuleRow } from './common/DelayRuleRow';

/**
 * Properties for configuring turn delay penalties.
 */
export interface TurnDelaySectionProps {
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
 * Form section component for adjusting cycling turn penalties (left, right, green arrow, indirect, u-turn).
 */
export const TurnDelaySection: React.FC<TurnDelaySectionProps> = ({ config, onChange }) => (
  <div className="rules-list">
    {TURN_FIELDS.map(({ key, label, icon, max, description }) => (
      <DelayRuleRow
        key={key}
        label={label}
        icon={icon}
        value={config[key]}
        max={max}
        description={description}
        valueLabel="Penalty"
        onChange={(newValue) => onChange({ ...config, [key]: newValue })}
      />
    ))}
  </div>
);
