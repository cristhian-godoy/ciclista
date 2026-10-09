import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SideToolbar } from './SideToolbar';

describe('SideToolbar Component', () => {
  it('renders branding, navigation buttons, and test runner button', () => {
    render(<SideToolbar mode="routing" onModeChange={vi.fn()} />);

    expect(screen.getByLabelText('Ciclista')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Routing Mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Places Mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Events' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();

    const testRunnerLink = screen.getByRole('link', { name: 'Test Runner' });
    expect(testRunnerLink).toBeInTheDocument();
    expect(testRunnerLink).toHaveAttribute('href', '/test');
  });

  it('marks routing mode as active when mode is routing', () => {
    render(<SideToolbar mode="routing" onModeChange={vi.fn()} />);

    const routingBtn = screen.getByRole('button', { name: 'Routing Mode' });
    const placesBtn = screen.getByRole('button', { name: 'Places Mode' });
    const studioBtn = screen.getByRole('button', { name: 'Events' });
    const editBtn = screen.getByRole('button', { name: 'Edit' });

    expect(routingBtn).toHaveClass('active');
    expect(routingBtn).toHaveAttribute('aria-pressed', 'true');
    expect(placesBtn).not.toHaveClass('active');
    expect(placesBtn).toHaveAttribute('aria-pressed', 'false');
    expect(studioBtn).not.toHaveClass('active');
    expect(studioBtn).toHaveAttribute('aria-pressed', 'false');
    expect(editBtn).not.toHaveClass('active');
    expect(editBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks edit mode as active when mode is edit', () => {
    render(<SideToolbar mode="edit" onModeChange={vi.fn()} />);

    const routingBtn = screen.getByRole('button', { name: 'Routing Mode' });
    const placesBtn = screen.getByRole('button', { name: 'Places Mode' });
    const studioBtn = screen.getByRole('button', { name: 'Events' });
    const editBtn = screen.getByRole('button', { name: 'Edit' });

    expect(editBtn).toHaveClass('active');
    expect(editBtn).toHaveAttribute('aria-pressed', 'true');
    expect(routingBtn).not.toHaveClass('active');
    expect(placesBtn).not.toHaveClass('active');
    expect(studioBtn).not.toHaveClass('active');
  });

  it('marks places mode as active when mode is places', () => {
    render(<SideToolbar mode="places" onModeChange={vi.fn()} />);

    const routingBtn = screen.getByRole('button', { name: 'Routing Mode' });
    const placesBtn = screen.getByRole('button', { name: 'Places Mode' });
    const studioBtn = screen.getByRole('button', { name: 'Events' });

    expect(placesBtn).toHaveClass('active');
    expect(placesBtn).toHaveAttribute('aria-pressed', 'true');
    expect(routingBtn).not.toHaveClass('active');
    expect(routingBtn).toHaveAttribute('aria-pressed', 'false');
    expect(studioBtn).not.toHaveClass('active');
    expect(studioBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks studio mode as active when mode is studio', () => {
    render(<SideToolbar mode="studio" onModeChange={vi.fn()} />);

    const routingBtn = screen.getByRole('button', { name: 'Routing Mode' });
    const placesBtn = screen.getByRole('button', { name: 'Places Mode' });
    const studioBtn = screen.getByRole('button', { name: 'Events' });

    expect(studioBtn).toHaveClass('active');
    expect(studioBtn).toHaveAttribute('aria-pressed', 'true');
    expect(routingBtn).not.toHaveClass('active');
    expect(routingBtn).toHaveAttribute('aria-pressed', 'false');
    expect(placesBtn).not.toHaveClass('active');
    expect(placesBtn).toHaveAttribute('aria-pressed', 'false');
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

  it('invokes onModeChange with places when Places Mode button is clicked', async () => {
    const user = userEvent.setup();
    const handleModeChange = vi.fn();

    render(<SideToolbar mode="routing" onModeChange={handleModeChange} />);

    const placesBtn = screen.getByRole('button', { name: 'Places Mode' });
    await user.click(placesBtn);

    expect(handleModeChange).toHaveBeenCalledTimes(1);
    expect(handleModeChange).toHaveBeenCalledWith('places');
  });

  it('invokes onModeChange with studio when Events button is clicked', async () => {
    const user = userEvent.setup();
    const handleModeChange = vi.fn();

    render(<SideToolbar mode="routing" onModeChange={handleModeChange} />);

    const studioBtn = screen.getByRole('button', { name: 'Events' });
    await user.click(studioBtn);

    expect(handleModeChange).toHaveBeenCalledTimes(1);
    expect(handleModeChange).toHaveBeenCalledWith('studio');
  });

  it('invokes onModeChange with edit when Edit button is clicked', async () => {
    const user = userEvent.setup();
    const handleModeChange = vi.fn();

    render(<SideToolbar mode="routing" onModeChange={handleModeChange} />);

    const editBtn = screen.getByRole('button', { name: 'Edit' });
    await user.click(editBtn);

    expect(handleModeChange).toHaveBeenCalledTimes(1);
    expect(handleModeChange).toHaveBeenCalledWith('edit');
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
