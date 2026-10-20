import React from 'react';

/**
 * Properties for the unified EmptyState placeholder component.
 */
export interface EmptyStateProps {
  /**
   * Optional illustrative leading icon.
   */
  icon?: React.ReactNode;
  /**
   * Primary title or heading.
   */
  title?: React.ReactNode;
  /**
   * Explanatory text or secondary message.
   */
  description?: React.ReactNode;
  /**
   * Optional action button or link node.
   */
  action?: React.ReactNode;
  /**
   * Optional additional class name appended to container.
   */
  className?: string;
}

/**
 * Reusable empty state placeholder component conforming to Ciclista design tokens.
 *
 * @param props - Configuration properties for icon, title, description, and action.
 * @returns Status placeholder element.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`ciclista-empty-state ${className}`.trim()} role="status">
      {icon && <div className="ciclista-empty-state-icon">{icon}</div>}
      {title && <h3 className="ciclista-empty-state-title">{title}</h3>}
      {description && <p className="ciclista-empty-state-desc">{description}</p>}
      {action && <div className="ciclista-empty-state-action">{action}</div>}
    </div>
  );
};
