import { X } from 'lucide-react';
import React from 'react';

/**
 * Properties for the unified CloseButton icon component.
 */
export interface CloseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Lucide X icon size in pixels. Defaults to 14.
   */
  size?: number;
  /**
   * Accessible button label and tooltip title. Defaults to 'Close'.
   */
  label?: string;
}

/**
 * Unified accessible close/dismiss button adhering to Ciclista glassmorphic styling conventions.
 *
 * @param props - Button properties including optional size and label.
 * @returns Accessible icon button element.
 */
export const CloseButton: React.FC<CloseButtonProps> = ({
  size = 14,
  label = 'Close',
  className = '',
  onClick,
  ...buttonProps
}) => {
  return (
    <button
      type="button"
      className={`ciclista-close-btn ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      title={label}
      {...buttonProps}
    >
      <X size={size} />
    </button>
  );
};
