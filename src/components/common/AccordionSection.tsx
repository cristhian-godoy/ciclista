import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';

/**
 * Properties for the AccordionSection collapsible component.
 */
export interface AccordionSectionProps {
  /**
   * Header title text or React node.
   */
  title: React.ReactNode;
  /**
   * Optional leading icon node.
   */
  icon?: React.ReactNode;
  /**
   * Controlled open state. If omitted, component operates in uncontrolled mode.
   */
  isOpen?: boolean;
  /**
   * Initial open state for uncontrolled operation. Defaults to false.
   */
  defaultOpen?: boolean;
  /**
   * Callback fired when expanding or collapsing the accordion section.
   */
  onToggle?: (isOpen: boolean) => void;
  /**
   * Optional custom actions or buttons rendered inside header before chevron toggle.
   */
  headerActions?: React.ReactNode;
  /**
   * Content displayed when the accordion is expanded.
   */
  children: React.ReactNode;
  /**
   * Optional class name applied to outer section container.
   */
  className?: string;
  /**
   * Optional class name applied to header toggle button.
   */
  headerClassName?: string;
  /**
   * Optional class name applied to expanded body container.
   */
  bodyClassName?: string;
  /**
   * Lucide chevron icon size in pixels. Defaults to 13.
   */
  chevronSize?: number;
}

/**
 * Reusable collapsible accordion section with header icon, title, optional actions, and chevron indicator.
 *
 * @param props - Component configuration options.
 * @returns Accordion section element.
 */
export const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  icon,
  isOpen: controlledOpen,
  defaultOpen = false,
  onToggle,
  headerActions,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  chevronSize = 13,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isExpanded = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleToggle = () => {
    const next = !isExpanded;
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onToggle?.(next);
  };

  return (
    <div className={`rules-section ${className}`.trim()}>
      <button
        type="button"
        className={`rules-section-toggle ${headerClassName}`.trim()}
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <span className="rules-section-btn-label">
          {icon}
          {title}
        </span>
        <div className="rules-section-header-actions" onClick={(e) => e.stopPropagation()}>
          {headerActions}
          {isExpanded ? <ChevronUp size={chevronSize} /> : <ChevronDown size={chevronSize} />}
        </div>
      </button>
      {isExpanded && <div className={bodyClassName || undefined}>{children}</div>}
    </div>
  );
};
