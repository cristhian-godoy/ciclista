import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RoutingConfigPanel } from './RoutingConfigPanel';

describe('RoutingConfigPanel', () => {
  it('renders city options and active selection', () => {
    render(
      <RoutingConfigPanel
        selectedPreset="munich"
        onPresetChange={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
        theme="bright"
        onThemeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('City Preset')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /City Preset/i })).toHaveValue('munich');
    expect(screen.getByRole('option', { name: /Munich/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Amsterdam/i })).toBeInTheDocument();
  });

  it('calls onPresetChange when a different city is selected', async () => {
    const user = userEvent.setup();
    const handlePresetChange = vi.fn();

    render(
      <RoutingConfigPanel
        selectedPreset="munich"
        onPresetChange={handlePresetChange}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
        theme="bright"
        onThemeChange={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /City Preset/i }), 'amsterdam');
    expect(handlePresetChange).toHaveBeenCalledWith('amsterdam');
  });

  it('calls onThemeChange when a different theme is selected', async () => {
    const user = userEvent.setup();
    const handleThemeChange = vi.fn();

    render(
      <RoutingConfigPanel
        selectedPreset="munich"
        onPresetChange={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
        theme="bright"
        onThemeChange={handleThemeChange}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /Map Theme/i }), 'dark');
    expect(handleThemeChange).toHaveBeenCalledWith('dark');
  });

  it('shows fetching status overlay when isFetchingOSM is true', () => {
    render(
      <RoutingConfigPanel
        selectedPreset="munich"
        onPresetChange={vi.fn()}
        isFetchingOSM={true}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
        theme="bright"
        onThemeChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Fetching street network from Overpass/i)).toBeInTheDocument();
  });

  it('shows active ebike button and triggers change callback when clicked', async () => {
    const user = userEvent.setup();
    const handleBikeChange = vi.fn();

    render(
      <RoutingConfigPanel
        selectedPreset="munich"
        onPresetChange={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={handleBikeChange}
        theme="bright"
        onThemeChange={vi.fn()}
      />,
    );

    const normalBtn = screen.getByRole('button', { name: /Normal/i });
    expect(normalBtn).toHaveClass('active');

    const ebikeBtn = screen.getByRole('button', { name: /E-Bike/i });
    await user.click(ebikeBtn);
    expect(handleBikeChange).toHaveBeenCalledWith({ id: 'ebike' });
  });
});
