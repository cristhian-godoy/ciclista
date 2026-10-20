import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RoutingConfigPanel } from './RoutingConfigPanel';

describe('RoutingConfigPanel', () => {
  it('renders start and destination inputs with swap button', () => {
    render(
      <RoutingConfigPanel
        startCoord={{ lat: 48.13715, lng: 11.5754 }}
        endCoord={{ lat: 48.135, lng: 11.582 }}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('Destination')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Swap start and destination/i })).toBeInTheDocument();

    expect(screen.getByLabelText('Start')).toHaveValue('48.13715, 11.57540');
    expect(screen.getByLabelText('Destination')).toHaveValue('48.13500, 11.58200');
  });

  it('triggers onSwapCoords when swap button is clicked', async () => {
    const user = userEvent.setup();
    const handleSwapCoords = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={{ lat: 48.13715, lng: 11.5754 }}
        endCoord={{ lat: 48.135, lng: 11.582 }}
        onSwapCoords={handleSwapCoords}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const swapBtn = screen.getByRole('button', { name: /Swap start and destination/i });
    await user.click(swapBtn);
    expect(handleSwapCoords).toHaveBeenCalledTimes(1);
  });

  it('calls onSetStartCoord when user edits start location and commits', async () => {
    const user = userEvent.setup();
    const handleSetStartCoord = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={handleSetStartCoord}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const startInput = screen.getByLabelText('Start');
    await user.type(startInput, '48.140, 11.580{Enter}');
    expect(handleSetStartCoord).toHaveBeenCalledWith({ lat: 48.14, lng: 11.58 });
  });

  it('calls onSetEndCoord when user edits destination location and blurs', async () => {
    const user = userEvent.setup();
    const handleSetEndCoord = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={handleSetEndCoord}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const endInput = screen.getByLabelText('Destination');
    await user.type(endInput, '48.145, 11.590');
    await user.tab();
    expect(handleSetEndCoord).toHaveBeenCalledWith({ lat: 48.145, lng: 11.59 });
  });

  it('shows fetching status overlay when isFetchingOSM is true', () => {
    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={true}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Fetching street network from Overpass/i)).toBeInTheDocument();
  });

  it('shows active ebike button and triggers change callback when clicked', async () => {
    const user = userEvent.setup();
    const handleBikeChange = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={handleBikeChange}
      />,
    );

    const standardBtn = screen.getByRole('button', { name: /Standard/i });
    expect(standardBtn).toHaveClass('active');

    const ebikeBtn = screen.getByRole('button', { name: /E-Bike/i });
    await user.click(ebikeBtn);
    expect(handleBikeChange).toHaveBeenCalledWith({ id: 'ebike' });
  });

  it('allows selecting Road profile and Custom profile', async () => {
    const user = userEvent.setup();
    const handleBikeChange = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={handleBikeChange}
      />,
    );

    const roadBtn = screen.getByRole('button', { name: /Road/i });
    await user.click(roadBtn);
    expect(handleBikeChange).toHaveBeenCalledWith({ id: 'road' });

    const customBtn = screen.getByRole('button', { name: /Custom/i });
    await user.click(customBtn);
    expect(handleBikeChange).toHaveBeenCalledWith({ id: 'custom' });
  });

  it('exposes custom bike profile settings and turn penalties when custom profile is active', async () => {
    const user = userEvent.setup();
    const handleBikeChange = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{
          id: 'custom',
          customSpeedKmh: 20,
          weightKg: 80,
          turnPenalties: { rightTurnPenaltySeconds: 2, leftTurnPenaltySeconds: 5 },
          surfacePreferences: { gravelSpeedMultiplier: 0.6, cobblestoneSpeedMultiplier: 0.7 },
        }}
        onBikeConfigChange={handleBikeChange}
      />,
    );

    expect(screen.getByLabelText('Speed (km/h)')).toHaveValue(20);
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(80);
    expect(screen.getByLabelText('Right Turn')).toHaveValue(2);
    expect(screen.getByLabelText('Left Turn')).toHaveValue(5);
    expect(screen.getByLabelText('Gravel')).toHaveValue(0.6);
    expect(screen.getByLabelText('Cobblestone')).toHaveValue(0.7);

    // Update custom speed
    const speedInput = screen.getByLabelText('Speed (km/h)');
    await user.clear(speedInput);
    await user.type(speedInput, '25');
    expect(handleBikeChange).toHaveBeenCalled();

    // Update right turn penalty
    const rightTurnInput = screen.getByLabelText('Right Turn');
    await user.clear(rightTurnInput);
    await user.type(rightTurnInput, '3');
    expect(handleBikeChange).toHaveBeenCalled();
  });

  it('supports multi-stop waypoints UI: add, edit, and remove stops', async () => {
    const user = userEvent.setup();
    const handleAddWaypoint = vi.fn();
    const handleUpdateWaypoint = vi.fn();
    const handleRemoveWaypoint = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={{ lat: 48.13, lng: 11.57 }}
        endCoord={{ lat: 48.15, lng: 11.59 }}
        waypoints={[{ lat: 48.14, lng: 11.58 }]}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        onAddWaypoint={handleAddWaypoint}
        onRemoveWaypoint={handleRemoveWaypoint}
        onUpdateWaypoint={handleUpdateWaypoint}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Stop 1')).toHaveValue('48.14000, 11.58000');

    // Add stop button
    const addStopBtn = screen.getByRole('button', { name: /\+ Add Stop/i });
    await user.click(addStopBtn);
    expect(handleAddWaypoint).toHaveBeenCalledTimes(1);

    // Remove stop button
    const removeStopBtn = screen.getByRole('button', { name: /Remove stop 1/i });
    await user.click(removeStopBtn);
    expect(handleRemoveWaypoint).toHaveBeenCalledWith(0);

    // Edit stop coordinate
    const stopInput = screen.getByLabelText('Stop 1');
    await user.clear(stopInput);
    await user.type(stopInput, '48.142, 11.582{Enter}');
    expect(handleUpdateWaypoint).toHaveBeenCalledWith(0, { lat: 48.142, lng: 11.582 });
  });
});
