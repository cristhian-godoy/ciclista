import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Footprints,
  Octagon,
  TrafficCone,
} from 'lucide-react';
import React, { useState } from 'react';

import type { NodeDelayConfig } from '../core/config';

interface IntersectionRowProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  max: number;
  description: string;
  onChange: (newValue: number) => void;
}

const IntersectionRow: React.FC<IntersectionRowProps> = ({
  label,
  icon,
  value,
  max,
  description,
  onChange,
}) => {
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
              Wait time: <strong>{value}s</strong>
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

interface IntersectionDelaySectionProps {
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
      <IntersectionRow
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
