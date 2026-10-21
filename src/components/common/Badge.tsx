import React from 'react';

/**
 * Visual variant options for the unified Ciclista Badge primitive.
 */
export type BadgeVariant =
  | 'default'
  | 'pass'
  | 'fail'
  | 'idle'
  | 'selected'
  | 'active'
  | 'signal'
  | 'bike'
  | 'tag'
  | 'road'
  | 'banned'
  | 'subtle'
  | 'keyboard'
  | 'strategy';

/**
 * Size options for the Badge primitive.
 */
export type BadgeSize = 'sm' | 'md';

/**
 * Properties for the unified Badge component.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Visual style variant. Defaults to 'default'.
   */
  variant?: BadgeVariant;
  /**
   * Component sizing scale. Defaults to 'md'.
   */
  size?: BadgeSize;
  /**
   * Optional leading icon or React element.
   */
  icon?: React.ReactNode;
  /**
   * Badge content.
   */
  children?: React.ReactNode;
}

/**
 * Unified Badge primitive component adhering to Ciclista design tokens.
 *
 * @param props - Badge configuration properties.
 * @returns Accessible badge element.
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  icon,
  children,
  className = '',
  ...restProps
}) => {
  const variantClass = variant !== 'default' ? `ciclista-badge--${variant}` : '';
  const sizeClass = size === 'sm' ? 'ciclista-badge--sm' : '';

  return (
    <span
      className={`ciclista-badge ${variantClass} ${sizeClass} ${className}`.trim()}
      {...restProps}
    >
      {icon && <span className="ciclista-badge-icon">{icon}</span>}
      {children}
    </span>
  );
};
