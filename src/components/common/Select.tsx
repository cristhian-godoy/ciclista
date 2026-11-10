import React, { forwardRef, useId } from 'react';

/**
 * Option descriptor for the custom Select dropdown primitive.
 */
export interface SelectOption<T extends string = string> {
  /**
   * Unique value for option.
   */
  value: T;
  /**
   * Human-readable label displayed to user.
   */
  label: string;
  /**
   * Whether this individual option is disabled.
   */
  disabled?: boolean;
}

/**
 * Properties for the Select primitive component.
 */
export interface SelectProps<T extends string = string> extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  /**
   * Currently active selected value.
   */
  value: T;
  /**
   * Callback fired when a new option is chosen.
   */
  onChange: (value: T) => void;
  /**
   * List of selectable options.
   */
  options: readonly SelectOption<T>[];
  /**
   * Optional label text rendered above the select control.
   */
  label?: React.ReactNode;
  /**
   * Optional CSS class appended to container wrapper.
   */
  containerClassName?: string;
  /**
   * Optional CSS class appended to select element.
   */
  selectClassName?: string;
  /**
   * Optional icon rendered inside or adjacent to the control.
   */
  icon?: React.ReactNode;
}

/**
 * Reusable design-system select primitive adhering to Ciclista theme tokens.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      value,
      onChange,
      options,
      label,
      containerClassName = '',
      selectClassName = '',
      icon,
      disabled = false,
      id: customId,
      ...selectProps
    },
    ref,
  ) => {
    const generatedId = useId();
    const selectId = customId || generatedId;

    return (
      <div className={`ciclista-form-group ${containerClassName}`.trim()}>
        {label && (
          <label htmlFor={selectId} className="ciclista-label">
            {label}
          </label>
        )}
        <div className="ciclista-select-wrapper">
          {icon && <span className="ciclista-select-icon">{icon}</span>}
          <select
            ref={ref}
            id={selectId}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className={`ciclista-select ${selectClassName}`.trim()}
            aria-label={
              selectProps['aria-label'] || (typeof label === 'string' ? label : undefined)
            }
            {...selectProps}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  },
);

Select.displayName = 'Select';
