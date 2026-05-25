import React, { useState } from 'react';

import type { ComfortLevel } from '../core/router/types';

interface SpeedTypeSelectorProps {
  value: 'relative' | 'slow' | 'slower' | 'dismount' | 'custom';
  disabled?: boolean;
  onChange: (val: 'relative' | 'slow' | 'slower' | 'dismount' | 'custom') => void;
}

/**
 * Interactive segmented selector representing cycling speed options (e.g. relative, slow, custom, dismount).
 * Displays a descriptive speed text dynamically upon selection or hover.
 */
export const SpeedTypeSelector: React.FC<SpeedTypeSelectorProps> = ({
  value,
  disabled,
  onChange,
}) => {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

  const OPTIONS = [
    { key: 'relative', label: 'Relative', speed: '100% (Bike Speed)' },
    { key: 'slow', label: 'Slow', speed: '15 km/h' },
    { key: 'slower', label: 'Slower', speed: '10 km/h' },
    { key: 'dismount', label: 'Dismount', speed: '4 km/h' },
    { key: 'custom', label: 'Custom', speed: 'Custom slider speed' },
  ] as const;

  const activeOption = OPTIONS.find((o) => o.key === (hoveredValue || value));

  return (
    <div className="speed-selector-container">
      <div className="speed-selector-buttons">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            className={`speed-selector-btn ${value === opt.key ? 'active' : ''}`}
            onClick={() => onChange(opt.key)}
            onMouseEnter={() => setHoveredValue(opt.key)}
            onMouseLeave={() => setHoveredValue(null)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="speed-selector-info">{activeOption ? activeOption.speed : ''}</div>
    </div>
  );
};

interface ComfortSelectorProps {
  value: ComfortLevel;
  onChange: (val: ComfortLevel) => void;
}

/**
 * Segmented button group selector representing comfort level options.
 * Maps custom comfort scores to descriptive route planning behaviors (e.g. avoid strongly, prefer).
 */
export const ComfortSelector: React.FC<ComfortSelectorProps> = ({ value, onChange }) => {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

  const OPTIONS = [
    { key: 'very_low', label: 'Very Low', desc: 'Avoid strongly in quiet routes' },
    { key: 'low', label: 'Low', desc: 'Avoid in quiet routes' },
    { key: 'neutral', label: 'Neutral', desc: 'Standard routing weight' },
    { key: 'high', label: 'High', desc: 'Prefer in quiet routes' },
    { key: 'very_high', label: 'Very High', desc: 'Prefer strongly in quiet routes' },
  ] as const;

  const activeOption = OPTIONS.find((o) => o.key === (hoveredValue || value));

  return (
    <div className="speed-selector-container">
      <div className="speed-selector-buttons">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`speed-selector-btn ${value === opt.key ? 'active' : ''}`}
            onClick={() => onChange(opt.key)}
            onMouseEnter={() => setHoveredValue(opt.key)}
            onMouseLeave={() => setHoveredValue(null)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="speed-selector-info">{activeOption ? activeOption.desc : ''}</div>
    </div>
  );
};
