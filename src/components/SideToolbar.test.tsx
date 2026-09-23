import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SideToolbar } from './SideToolbar';

describe('SideToolbar Component', () => {
  it('renders branding, navigation buttons, and test runner button', () => {
    render(<SideToolbar mode="routing" onModeChange={vi.fn()} />);

    expect(screen.getByLabelText('Ciclista')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Routing Mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Studio Mode' })).toBeInTheDocument();

    const testRunnerLink = screen.getByRole('link', { name: 'Test Runner' });
    expect(testRunnerLink).toBeInTheDocument();
    expect(testRunnerLink).toHaveAttribute('href', '/test');
  });

  it('marks routing mode as active when mode is routing', () => {
    render(<SideToolbar mode="routing" onModeChange={vi.fn()} />);

    const routingBtn = screen.getByRole('button', { name: 'Routing Mode' });
    const studioBtn = screen.getByRole('button', { name: 'Studio Mode' });

    expect(routingBtn).toHaveClass('active');
    expect(routingBtn).toHaveAttribute('aria-pressed', 'true');
    expect(studioBtn).not.toHaveClass('active');
    expect(studioBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks studio mode as active when mode is studio', () => {
    render(<SideToolbar mode="studio" onModeChange={vi.fn()} />);

    const routingBtn = screen.getByRole('button', { name: 'Routing Mode' });
    const studioBtn = screen.getByRole('button', { name: 'Studio Mode' });

    expect(studioBtn).toHaveClass('active');
    expect(studioBtn).toHaveAttribute('aria-pressed', 'true');
    expect(routingBtn).not.toHaveClass('active');
    expect(routingBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('invokes onModeChange with routing when Routing Mode button is clicked', async () => {
    const user = userEvent.setup();
    const handleModeChange = vi.fn();

    render(<SideToolbar mode="studio" onModeChange={handleModeChange} />);

    const routingBtn = screen.getByRole('button', { name: 'Routing Mode' });
    await user.click(routingBtn);

    expect(handleModeChange).toHaveBeenCalledTimes(1);
    expect(handleModeChange).toHaveBeenCalledWith('routing');
  });

  it('invokes onModeChange with studio when Studio Mode button is clicked', async () => {
    const user = userEvent.setup();
    const handleModeChange = vi.fn();

    render(<SideToolbar mode="routing" onModeChange={handleModeChange} />);

    const studioBtn = screen.getByRole('button', { name: 'Studio Mode' });
    await user.click(studioBtn);

    expect(handleModeChange).toHaveBeenCalledTimes(1);
    expect(handleModeChange).toHaveBeenCalledWith('studio');
  });

  it('triggers onOpenTestRunner callback when clicking test runner link if provided', async () => {
    const user = userEvent.setup();
    const handleOpenTestRunner = vi.fn();

    render(
      <SideToolbar mode="routing" onModeChange={vi.fn()} onOpenTestRunner={handleOpenTestRunner} />,
    );

    const testRunnerLink = screen.getByRole('link', { name: 'Test Runner' });
    await user.click(testRunnerLink);

    expect(handleOpenTestRunner).toHaveBeenCalledTimes(1);
  });
});
