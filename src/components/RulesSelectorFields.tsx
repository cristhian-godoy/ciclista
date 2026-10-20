import React from 'react';

import type { ComfortLevel } from '../core/config';
import { SegmentedControl, type SegmentedControlOption } from './common/SegmentedControl';

/**
 * Properties for the SpeedTypeSelector segmented control component.
 */
export interface SpeedTypeSelectorProps {
  value: 'relative' | 'slow' | 'slower' | 'dismount' | 'custom';
  disabled?: boolean;
  onChange: (val: 'relative' | 'slow' | 'slower' | 'dismount' | 'custom') => void;
}

const SPEED_OPTIONS: readonly SegmentedControlOption<
  'relative' | 'slow' | 'slower' | 'dismount' | 'custom'
>[] = [
  { key: 'relative', label: 'Relative', description: '100% (Bike Speed)' },
  { key: 'slow', label: 'Slow', description: '15 km/h' },
  { key: 'slower', label: 'Slower', description: '10 km/h' },
  { key: 'dismount', label: 'Dismount', description: '4 km/h' },
  { key: 'custom', label: 'Custom', description: 'Custom slider speed' },
] as const;

/**
 * Interactive segmented selector representing cycling speed options (e.g. relative, slow, custom, dismount).
 * Displays a descriptive speed text dynamically upon selection or hover.
 */
export const SpeedTypeSelector: React.FC<SpeedTypeSelectorProps> = ({
  value,
  disabled,
  onChange,
}) => {
  return (
    <SegmentedControl
      options={SPEED_OPTIONS}
      value={value}
      disabled={disabled}
      onChange={onChange}
    />
  );
};

/**
 * Properties for the ComfortSelector segmented control component.
 */
export interface ComfortSelectorProps {
  value: ComfortLevel;
  onChange: (val: ComfortLevel) => void;
}

const COMFORT_OPTIONS: readonly SegmentedControlOption<ComfortLevel>[] = [
  { key: 'very_low', label: 'Very Low', description: 'Avoid strongly in quiet routes' },
  { key: 'low', label: 'Low', description: 'Avoid in quiet routes' },
  { key: 'neutral', label: 'Neutral', description: 'Standard routing weight' },
  { key: 'high', label: 'High', description: 'Prefer in quiet routes' },
  { key: 'very_high', label: 'Very High', description: 'Prefer strongly in quiet routes' },
] as const;

/**
 * Segmented button group selector representing comfort level options.
 * Maps custom comfort scores to descriptive route planning behaviors (e.g. avoid strongly, prefer).
 */
export const ComfortSelector: React.FC<ComfortSelectorProps> = ({ value, onChange }) => {
  return <SegmentedControl options={COMFORT_OPTIONS} value={value} onChange={onChange} />;
};
