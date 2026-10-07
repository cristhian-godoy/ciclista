import { X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

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
}

/**
 * Accessible, reusable glassmorphic dialog modal conforming to the Ciclista design system.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  ariaLabel,
  className,
}) => {
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accessibleLabel = typeof title === 'string' ? undefined : ariaLabel;
  const labelledBy = typeof title === 'string' ? 'ciclista-modal-title' : undefined;

  return (
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
};
