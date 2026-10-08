import { X } from 'lucide-react';
import React, { useEffect } from 'react';

/**
 * Screen anchor position variants for the toast container.
 */
export type ToastPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'bottom-center'
  | 'top-center';

/**
 * Properties for the configurable Toast notification component.
 */
export interface ToastProps {
  /**
   * Main text message or custom React content rendered inside the toast.
   */
  message: React.ReactNode;
  /**
   * Optional leading icon element.
   */
  icon?: React.ReactNode;
  /**
   * Whether the notification persists indefinitely until dismissed by user action.
   * Defaults to false.
   */
  persistent?: boolean;
  /**
   * Time duration in milliseconds before automatic dismissal.
   * Ignored if persistent is set to true.
   */
  duration?: number;
  /**
   * Screen anchor position for the toast.
   * Defaults to 'bottom-right'.
   */
  position?: ToastPosition;
  /**
   * Callback fired when the notification is closed or automatically dismissed.
   */
  onClose?: () => void;
  /**
   * Optional custom action button or secondary node.
   */
  action?: React.ReactNode;
  /**
   * Optional additional CSS class names.
   */
  className?: string;
  /**
   * ARIA live region politeness level.
   * Defaults to 'polite'.
   */
  ariaLive?: 'polite' | 'assertive';
}

/**
 * Reusable, accessible, glassmorphic toast notification component adhering
 * to Ciclista design tokens and styling conventions.
 *
 * @param props - Component configuration options.
 * @returns Toast element rendered in fixed viewport positioning.
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  icon,
  persistent = false,
  duration,
  position = 'bottom-right',
  onClose,
  action,
  className = '',
  ariaLive = 'polite',
}) => {
  useEffect(() => {
    if (persistent || !duration || duration <= 0 || !onClose) {
      return;
    }

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [persistent, duration, onClose]);

  return (
    <div
      role="status"
      aria-live={ariaLive}
      className={`ciclista-toast ciclista-toast--${position} ${className}`.trim()}
    >
      {icon && <span className="ciclista-toast-icon">{icon}</span>}
      <div className="ciclista-toast-content">{message}</div>
      {action && <div className="ciclista-toast-action">{action}</div>}
      {onClose && (
        <button
          type="button"
          className="ciclista-toast-close-btn"
          onClick={onClose}
          aria-label="Dismiss notification"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
