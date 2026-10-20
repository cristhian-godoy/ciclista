import React from 'react';

/**
 * Properties for the unified SliderField form group component.
 */
export interface SliderFieldProps {
  /**
   * Field label text or React node.
   */
  label: React.ReactNode;
  /**
   * Controlled numeric value.
   */
  value: number;
  /**
   * Minimum slider value.
   */
  min: number;
  /**
   * Maximum slider value.
   */
  max: number;
  /**
   * Step increment. Defaults to 1.
   */
  step?: number;
  /**
   * Unit suffix displayed alongside the value (e.g. 's', 'km/h', 'm'). Defaults to 's'.
   */
  unit?: string;
  /**
   * Optional prefix character for positive numbers (e.g. '+').
   */
  valuePrefix?: string;
  /**
   * Whether the slider input is disabled. Defaults to false.
   */
  disabled?: boolean;
  /**
   * Callback fired when value changes.
   */
  onChange: (value: number) => void;
  /**
   * Optional CSS class name appended to outer container.
   */
  className?: string;
  /**
   * Optional CSS class name appended to range input.
   */
  sliderClassName?: string;
  /**
   * Optional accessible label.
   */
  ariaLabel?: string;
  /**
   * Custom format function for the label or string template. If provided, overrides default `{label}: <strong>...</strong>`.
   */
  formatValueText?: (label: React.ReactNode, value: number, unit: string) => React.ReactNode;
}

/**
 * Reusable slider form control displaying dynamic current value badge and range slider input.
 *
 * @param props - Slider configuration options.
 * @returns Range slider form field element.
 */
export const SliderField: React.FC<SliderFieldProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 's',
  valuePrefix = '',
  disabled = false,
  onChange,
  className = '',
  sliderClassName = '',
  ariaLabel,
  formatValueText,
}) => {
  return (
    <div className={`ciclista-form-group--small ${className}`.trim()}>
      <label>
        {formatValueText ? (
          formatValueText(label, value, unit)
        ) : (
          <>
            {label}:{' '}
            <strong>
              {valuePrefix}
              {value}
              {unit}
            </strong>
          </>
        )}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`ciclista-slider--small ${sliderClassName}`.trim()}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      />
    </div>
  );
};
