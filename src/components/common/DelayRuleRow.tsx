import React from 'react';

import { AccordionSection } from './AccordionSection';
import { SliderField } from './SliderField';

/**
 * Properties for the unified DelayRuleRow component.
 */
export interface DelayRuleRowProps {
  /**
   * Header title label describing the delay rule.
   */
  label: string;
  /**
   * Leading infrastructure icon node.
   */
  icon: React.ReactNode;
  /**
   * Current numeric delay/penalty value in seconds.
   */
  value: number;
  /**
   * Maximum range limit in seconds.
   */
  max: number;
  /**
   * Descriptive explanatory text displayed inside the expanded section.
   */
  description: string;
  /**
   * Value label prefix (e.g. 'Wait time' or 'Penalty').
   */
  valueLabel: string;
  /**
   * Callback fired when the numeric slider value changes.
   */
  onChange: (newValue: number) => void;
}

/**
 * Shared collapsible row component for traffic delay and turn penalty rules.
 * Combines AccordionSection toggle with SliderField control.
 */
export const DelayRuleRow: React.FC<DelayRuleRowProps> = ({
  label,
  icon,
  value,
  max,
  description,
  valueLabel,
  onChange,
}) => {
  return (
    <AccordionSection
      className="rules-item"
      headerClassName="rules-item-header"
      bodyClassName="rules-item-body"
      icon={<span className="rules-item-icon">{icon}</span>}
      title={<span className="rules-item-name">{label}</span>}
      chevronSize={12}
    >
      <p className="rules-item-desc">{description}</p>
      <SliderField
        label={valueLabel}
        value={value}
        min={0}
        max={max}
        step={1}
        unit="s"
        onChange={onChange}
      />
    </AccordionSection>
  );
};
