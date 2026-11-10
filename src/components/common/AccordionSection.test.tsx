import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AccordionSection } from './AccordionSection';

describe('AccordionSection Component', () => {
  it('renders collapsed by default with title and chevron', () => {
    render(
      <AccordionSection title="Section Title">
        <div>Content Details</div>
      </AccordionSection>,
    );

    expect(screen.getByText('Section Title')).toBeInTheDocument();
    expect(screen.queryByText('Content Details')).not.toBeInTheDocument();
    const toggleBtn = screen.getByRole('button', { name: /section title/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders expanded when defaultOpen is true', () => {
    render(
      <AccordionSection title="Expanded Section" defaultOpen>
        <div>Visible Body</div>
      </AccordionSection>,
    );

    expect(screen.getByText('Visible Body')).toBeInTheDocument();
    const toggleBtn = screen.getByRole('button', { name: /expanded section/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles expansion when clicking on the toggle button', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <AccordionSection title="Toggle Section" onToggle={onToggle}>
        <div>Accordion Body</div>
      </AccordionSection>,
    );

    const toggleBtn = screen.getByRole('button', { name: /toggle section/i });
    await user.click(toggleBtn);

    expect(screen.getByText('Accordion Body')).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(onToggle).toHaveBeenCalledWith(true);

    await user.click(toggleBtn);
    expect(screen.queryByText('Accordion Body')).not.toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('toggles expansion when clicking directly on the chevron icon', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    const { container } = render(
      <AccordionSection title="Chevron Target" onToggle={onToggle}>
        <div>Details under chevron</div>
      </AccordionSection>,
    );

    const chevron = container.querySelector('.rules-section-header-actions svg');
    expect(chevron).not.toBeNull();

    if (chevron) {
      await user.click(chevron);
    }

    expect(screen.getByText('Details under chevron')).toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('does not toggle accordion when clicking on custom headerActions', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const actionClick = vi.fn();

    render(
      <AccordionSection
        title="Actions Test"
        onToggle={onToggle}
        headerActions={
          <button type="button" onClick={actionClick} data-testid="custom-action-btn">
            Action
          </button>
        }
      >
        <div>Restricted Content</div>
      </AccordionSection>,
    );

    const actionButton = screen.getByTestId('custom-action-btn');
    await user.click(actionButton);

    expect(actionClick).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.queryByText('Restricted Content')).not.toBeInTheDocument();
  });

  it('respects controlled isOpen prop', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    const { rerender } = render(
      <AccordionSection title="Controlled Section" isOpen={false} onToggle={onToggle}>
        <div>Controlled Body</div>
      </AccordionSection>,
    );

    expect(screen.queryByText('Controlled Body')).not.toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /controlled section/i });
    await user.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledWith(true);
    // In controlled mode without parent re-render, body remains hidden
    expect(screen.queryByText('Controlled Body')).not.toBeInTheDocument();

    // Re-render with isOpen = true
    rerender(
      <AccordionSection title="Controlled Section" isOpen={true} onToggle={onToggle}>
        <div>Controlled Body</div>
      </AccordionSection>,
    );
    expect(screen.getByText('Controlled Body')).toBeInTheDocument();
  });

  it('supports keyboard navigation via Enter and Space keys', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <AccordionSection title="Keyboard Section" onToggle={onToggle}>
        <div>Keyboard Body</div>
      </AccordionSection>,
    );

    const toggleBtn = screen.getByRole('button', { name: /keyboard section/i });
    toggleBtn.focus();

    await user.keyboard('{Enter}');
    expect(screen.getByText('Keyboard Body')).toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledWith(true);

    await user.keyboard(' ');
    expect(screen.queryByText('Keyboard Body')).not.toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('applies custom class names and renders leading icon', () => {
    render(
      <AccordionSection
        title="Custom Classes"
        icon={<span data-testid="custom-icon">Icon</span>}
        className="my-section"
        headerClassName="my-header"
        bodyClassName="my-body"
        defaultOpen
      >
        <div>Customized Body</div>
      </AccordionSection>,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.getByText('Customized Body').parentElement).toHaveClass('my-body');
  });
});
