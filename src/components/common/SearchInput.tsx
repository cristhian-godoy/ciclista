import React, { forwardRef } from 'react';

import { Search, X } from './Icon';

/**
 * Properties for the unified SearchInput field component.
 */
export interface SearchInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange'
> {
  /**
   * Controlled search query string.
   */
  value: string;
  /**
   * Callback fired when input text changes.
   */
  onChange: (value: string) => void;
  /**
   * Optional callback fired when clear button is clicked.
   */
  onClear?: () => void;
  /**
   * Lucide search icon size in pixels. Defaults to 14.
   */
  iconSize?: number;
  /**
   * Optional CSS class name appended to outer wrapper.
   */
  containerClassName?: string;
  /**
   * Optional CSS class name appended to input element.
   */
  inputClassName?: string;
}

/**
 * Reusable searchable input component with leading search icon and optional clear button.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = 'Search...',
      iconSize = 14,
      containerClassName = '',
      inputClassName = '',
      ...inputProps
    },
    ref,
  ) => {
    return (
      <div className={`ciclista-search-bar ${containerClassName}`.trim()}>
        <Search size={iconSize} className="ciclista-search-icon" aria-hidden="true" />
        <input
          ref={ref}
          type="text"
          className={`ciclista-input ciclista-search-input ${inputClassName}`.trim()}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...inputProps}
        />
        {onClear && value.length > 0 && (
          <button
            type="button"
            className="ciclista-search-clear-btn"
            onClick={onClear}
            aria-label="Clear search query"
            title="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
