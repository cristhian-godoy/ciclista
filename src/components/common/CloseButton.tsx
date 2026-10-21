import React from 'react';

import { X } from './Icon';

/**
 * Visual variant options for the unified CloseButton primitive.
 */
export type CloseButtonVariant = 'default' | 'modal' | 'toast' | 'dock' | 'popup' | 'inspector';

/**
 * Size scale options for the CloseButton primitive.
 */
export type CloseButtonSize = 'sm' | 'md' | 'lg';

/**
 * Properties for the unified CloseButton icon component.
 */
export interface CloseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Lucide X icon size in pixels or custom icon override. If omitted, derives from `size`.
   */
  iconSize?: number;
  /**
   * Size scale for close button padding and icon sizing. Defaults to 'md'.
   */
  size?: CloseButtonSize;
  /**
   * Visual style variant. Defaults to 'default'.
   */
  variant?: CloseButtonVariant;
  /**
   * Accessible button label and tooltip title. Defaults to 'Close'.
   */
  label?: string;
  /**
   * Custom icon element replacing the default Lucide X icon.
   */
  icon?: React.ReactNode;
}

/**
 * Unified accessible close/dismiss button adhering to Ciclista glassmorphic styling conventions.
 *
 * @param props - Button properties including optional size, variant, icon, and label.
 * @returns Accessible icon button element.
 */
export const CloseButton: React.FC<CloseButtonProps> = ({
  size = 'md',
  iconSize,
  variant = 'default',
  label = 'Close',
  icon,
  className = '',
  onClick,
  ...buttonProps
}) => {
  const resolvedIconSize = iconSize ?? (size === 'sm' ? 12 : size === 'lg' ? 18 : 14);
  const variantClass = variant !== 'default' ? `ciclista-close-btn--${variant}` : '';
  const sizeClass = size !== 'md' ? `ciclista-close-btn--${size}` : '';

  return (
    <button
      type="button"
      className={`ciclista-close-btn ${variantClass} ${sizeClass} ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      title={label}
      {...buttonProps}
    >
      {icon ?? <X size={resolvedIconSize} />}
    </button>
  );
};
