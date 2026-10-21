import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NavigationControlCard } from './NavigationControlCard';

describe('NavigationControlCard', () => {
  it('renders start navigation button when not navigating', async () => {
    const user = userEvent.setup();
    const onStartNavigation = vi.fn();
    const onBeforeStartNavigation = vi.fn();

    render(
      <NavigationControlCard
        isNavigating={false}
        onStartNavigation={onStartNavigation}
        onStopNavigation={vi.fn()}
        onToggleCameraMode={vi.fn()}
        cameraMode="heading-up"
        navigationProgress={null}
        onBeforeStartNavigation={onBeforeStartNavigation}
      />,
    );

    const button = screen.getByRole('button', { name: /start navigation/i });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(onBeforeStartNavigation).toHaveBeenCalledTimes(1);
    expect(onStartNavigation).toHaveBeenCalledTimes(1);
  });

  it('renders active navigation controls and progress when navigating', async () => {
    const user = userEvent.setup();
    const onStopNavigation = vi.fn();
    const onToggleCameraMode = vi.fn();

    render(
      <NavigationControlCard
        isNavigating={true}
        onStartNavigation={vi.fn()}
        onStopNavigation={onStopNavigation}
        onToggleCameraMode={onToggleCameraMode}
        cameraMode="north-up"
        navigationProgress={{
          distanceCoveredM: 200,
          distanceRemainingM: 1500,
          etaSeconds: 125,
          elapsedSeconds: 30,
          averageSpeedKmh: 18,
          currentSpeedKmh: 20,
        }}
      />,
    );

    expect(screen.getByText('Active Navigation')).toBeInTheDocument();
    expect(screen.getByText('1.5 km')).toBeInTheDocument();
    expect(screen.getByText('2m 5s')).toBeInTheDocument();

    const toggleBtn = screen.getByTitle(/toggle camera mode/i);
    await user.click(toggleBtn);
    expect(onToggleCameraMode).toHaveBeenCalledTimes(1);

    const stopBtn = screen.getByTitle(/stop navigation/i);
    await user.click(stopBtn);
    expect(onStopNavigation).toHaveBeenCalledTimes(1);
  });
});
