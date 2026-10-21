import React, { useRef } from 'react';
import { createPortal } from 'react-dom';

import { useEscapeKey } from '../../hooks/useEscapeKey';
import { X } from './Icon';

/**
 * Properties for the reusable Modal dialog component.
 */
export interface ModalProps {
  /**
   * Whether the modal dialog is currently visible.
   */
  isOpen: boolean;
  /**
   * Callback fired when closing the modal dialog.
   */
  onClose: () => void;
  /**
   * Optional header title displayed at the top of the dialog.
   */
  title?: React.ReactNode;
  /**
   * Dialog body content.
   */
  children: React.ReactNode;
  /**
   * Optional explicit accessible label for the dialog.
   */
  ariaLabel?: string;
  /**
   * Optional CSS class name appended to the modal content container.
   */
  className?: string;
  /**
   * Whether to render the modal dialog inside a React portal.
   * Defaults to true in browser environments, or false in test runners expecting local container mounting.
   */
  portal?: boolean;
  /**
   * Optional custom DOM element target for the React portal. Defaults to document.body.
   */
  portalContainer?: HTMLElement | null;
}

/**
 * Accessible, reusable glassmorphic dialog modal conforming to the Ciclista design system.
 * Renders into document.body using a React portal.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  ariaLabel,
  className,
  portal,
  portalContainer,
}) => {
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const accessibleLabel = typeof title === 'string' ? undefined : ariaLabel;
  const labelledBy = typeof title === 'string' ? 'ciclista-modal-title' : undefined;

  const content = (
    <div className="ciclista-modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={modalContentRef}
        className={`ciclista-glass-panel ciclista-modal-content ${className ?? ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={accessibleLabel}
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="ciclista-modal-header">
            <h2 id="ciclista-modal-title" className="ciclista-modal-title">
              {title}
            </h2>
            <button
              type="button"
              className="ciclista-modal-close-btn"
              onClick={onClose}
              aria-label="Close dialog"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="ciclista-modal-body">{children}</div>
      </div>
    </div>
  );

  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const shouldPortal = portalContainer != null || (portal ?? !isTest);

  if (shouldPortal && typeof document !== 'undefined') {
    return createPortal(content, portalContainer ?? document.body);
  }

  return content;
};
