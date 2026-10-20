import { AlertTriangle, Footprints, Octagon, TrafficCone } from 'lucide-react';
import React from 'react';

import type { NodeDelayConfig } from '../core/config';
import { DelayRuleRow } from './common/DelayRuleRow';

/**
 * Properties for configuring intersection node delays.
 */
export interface IntersectionDelaySectionProps {
  config: NodeDelayConfig;
  onChange: (updated: NodeDelayConfig) => void;
}

const DELAY_FIELDS: {
  key: keyof NodeDelayConfig;
  label: string;
  icon: React.ReactNode;
  max: number;
  description: string;
}[] = [
  {
    key: 'signalSeconds',
    label: 'Traffic Light',
    icon: <TrafficCone size={14} aria-label="Traffic Light Icon" />,
    max: 120,
    description: 'Default wait time when passing through a traffic light intersection.',
  },
  {
    key: 'yieldSeconds',
    label: 'Yield Sign',
    icon: <AlertTriangle size={14} aria-label="Yield Sign Icon" />,
    max: 60,
    description: 'Default time penalty/slowdown when crossing a road with a yield sign.',
  },
  {
    key: 'stopSeconds',
    label: 'Stop Sign',
    icon: <Octagon size={14} aria-label="Stop Sign Icon" />,
    max: 60,
    description: 'Default wait time for bringing the bicycle to a complete stop at a stop sign.',
  },
  {
    key: 'crossingSeconds',
    label: 'Pedestrian Crossing',
    icon: <Footprints size={14} aria-label="Pedestrian Crossing Icon" />,
    max: 60,
    description: 'Default time penalty/slowdown when encountering a pedestrian crossing.',
  },
];

/**
 * Form section component for adjusting traffic infrastructure time penalties.
 * Allows configuring delay modifiers for signals, yield signs, stops, and crossings.
 */
export const IntersectionDelaySection: React.FC<IntersectionDelaySectionProps> = ({
  config,
  onChange,
}) => (
  <div className="rules-list">
    {DELAY_FIELDS.map(({ key, label, icon, max, description }) => (
      <DelayRuleRow
        key={key}
        label={label}
        icon={icon}
        value={config[key]}
        max={max}
        description={description}
        valueLabel="Wait time"
        onChange={(newValue) => onChange({ ...config, [key]: newValue })}
      />
    ))}
  </div>
);
