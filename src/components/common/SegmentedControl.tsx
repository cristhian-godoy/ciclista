import React, { useState } from 'react';

/**
 * Option descriptor for the unified SegmentedControl button group.
 */
export interface SegmentedControlOption<T extends string> {
  /**
   * Unique option key identifier.
   */
  key: T;
  /**
   * Display text or React node for button.
   */
  label: React.ReactNode;
  /**
   * Optional description text displayed on hover or below the button group.
   */
  description?: React.ReactNode;
  /**
   * Optional leading icon node.
   */
  icon?: React.ReactNode;
  /**
   * Whether this individual option is disabled.
   */
  disabled?: boolean;
}

/**
 * Properties for the SegmentedControl component.
 */
export interface SegmentedControlProps<T extends string> {
  /**
   * List of available segmented control options.
   */
  options: readonly SegmentedControlOption<T>[];
  /**
   * Currently active selected key value.
   */
  value: T;
  /**
   * Callback fired when selecting an option.
   */
  onChange: (value: T) => void;
  /**
   * Whether the entire control is disabled. Defaults to false.
   */
  disabled?: boolean;
  /**
   * Optional CSS class name appended to container.
   */
  className?: string;
  /**
   * Optional CSS class name appended to button elements.
   */
  buttonClassName?: string;
  /**
   * Whether to display description info below the buttons. Defaults to true.
   */
  showDescription?: boolean;
  /**
   * Optional accessible label for the group.
   */
  ariaLabel?: string;
}

/**
 * Reusable segmented button group control with active states and dynamic hover description.
 *
 * @param props - Component configuration options.
 * @returns Segmented button bar element.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  buttonClassName = '',
  showDescription = true,
  ariaLabel,
}: SegmentedControlProps<T>): React.ReactElement {
  const [hoveredValue, setHoveredValue] = useState<T | null>(null);

  const activeOption = options.find((opt) => opt.key === (hoveredValue || value));

  return (
    <div
      className={`speed-selector-container ${className}`.trim()}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="speed-selector-buttons">
        {options.map((opt) => {
          const isActive = value === opt.key;
          const isBtnDisabled = disabled || opt.disabled;

          return (
            <button
              key={opt.key}
              type="button"
              disabled={isBtnDisabled}
              className={`speed-selector-btn ${buttonClassName} ${isActive ? 'active' : ''}`.trim()}
              onClick={() => onChange(opt.key)}
              onMouseEnter={() => setHoveredValue(opt.key)}
              onMouseLeave={() => setHoveredValue(null)}
              aria-pressed={isActive}
            >
              {opt.icon && <span className="speed-selector-btn-icon">{opt.icon}</span>}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
      {showDescription && (
        <div className="speed-selector-info">
          {activeOption?.description ? activeOption.description : ''}
        </div>
      )}
    </div>
  );
}
