import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { MapLayerDock } from './MapLayerDock';

describe('MapLayerDock', () => {
  it('renders expanded mode with show/hide minor controls button', async () => {
    const user = userEvent.setup();
    const handleSetShowMinor = vi.fn();
    const handleSetDockExpanded = vi.fn();

    render(
      <MapLayerDock
        showMinorControls={false}
        setShowMinorControls={handleSetShowMinor}
        dockExpanded={true}
        setDockExpanded={handleSetDockExpanded}
      />,
    );

    expect(screen.getByText('Map Layers')).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Show Minor Controls/i });
    expect(toggleBtn).toBeInTheDocument();

    await user.click(toggleBtn);
    expect(handleSetShowMinor).toHaveBeenCalled();

    // Click collapse button
    const buttons = screen.getAllByRole('button');
    const collapseBtn = buttons[1]; // ChevronDown button
    await user.click(collapseBtn);
    expect(handleSetDockExpanded).toHaveBeenCalledWith(false);
  });

  it('renders collapsed mode showing sliders expand button', async () => {
    const user = userEvent.setup();
    const handleSetDockExpanded = vi.fn();

    render(
      <MapLayerDock
        showMinorControls={false}
        setShowMinorControls={vi.fn()}
        dockExpanded={false}
        setDockExpanded={handleSetDockExpanded}
      />,
    );

    expect(screen.queryByText('Map Layers')).not.toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: /Show Map Controls/i });
    expect(expandBtn).toBeInTheDocument();

    await user.click(expandBtn);
    expect(handleSetDockExpanded).toHaveBeenCalledWith(true);
  });
});
