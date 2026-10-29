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

    // Add stop button (parameterless call, no event passed)
    const addStopBtn = screen.getByRole('button', { name: /Add Stop/i });
    await user.click(addStopBtn);
    expect(handleAddWaypoint).toHaveBeenCalledWith();

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

  it('disables Add Stop button with guidance helper when start or destination are missing', () => {
    const handleAddWaypoint = vi.fn();

    const { rerender } = render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={{ lat: 48.15, lng: 11.59 }}
        waypoints={[]}
        onAddWaypoint={handleAddWaypoint}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const addStopBtn = screen.getByRole('button', { name: /Add Stop/i });
    expect(addStopBtn).toBeDisabled();
    expect(
      screen.getByText('Set start and destination before adding intermediate stops'),
    ).toBeInTheDocument();

    rerender(
      <RoutingConfigPanel
        startCoord={{ lat: 48.13, lng: 11.57 }}
        endCoord={null}
        waypoints={[]}
        onAddWaypoint={handleAddWaypoint}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Add Stop/i })).toBeDisabled();
    expect(
      screen.getByText('Set start and destination before adding intermediate stops'),
    ).toBeInTheDocument();
  });

  it('disables Add Stop button when active stop placement is in progress', () => {
    render(
      <RoutingConfigPanel
        startCoord={{ lat: 48.13, lng: 11.57 }}
        endCoord={{ lat: 48.15, lng: 11.59 }}
        waypoints={[]}
        isPlacingStop={true}
        onAddWaypoint={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Add Stop/i })).toBeDisabled();
  });

  it('supports stop reordering and map pick button controls', async () => {
    const user = userEvent.setup();
    const handleReorderWaypoints = vi.fn();
    const handleStartPlacingStop = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={{ lat: 48.13, lng: 11.57 }}
        endCoord={{ lat: 48.15, lng: 11.59 }}
        waypoints={[
          { lat: 48.135, lng: 11.575 },
          { lat: 48.14, lng: 11.58 },
          { lat: 48.145, lng: 11.585 },
        ]}
        onAddWaypoint={vi.fn()}
        onReorderWaypoints={handleReorderWaypoints}
        onStartPlacingStop={handleStartPlacingStop}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    // Numbered badges match stop index
    expect(screen.getByText('1')).toHaveClass('ciclista-waypoint-badge');
    expect(screen.getByText('2')).toHaveClass('ciclista-waypoint-badge');
    expect(screen.getByText('3')).toHaveClass('ciclista-waypoint-badge');

    // First stop: Move Up is disabled, Move Down is enabled
    const moveUpStop1 = screen.getByRole('button', { name: /Move stop 1 up/i });
    const moveDownStop1 = screen.getByRole('button', { name: /Move stop 1 down/i });
    expect(moveUpStop1).toBeDisabled();
    expect(moveDownStop1).not.toBeDisabled();

    await user.click(moveDownStop1);
    expect(handleReorderWaypoints).toHaveBeenCalledWith(0, 1);

    // Last stop: Move Down is disabled, Move Up is enabled
    const moveUpStop3 = screen.getByRole('button', { name: /Move stop 3 up/i });
    const moveDownStop3 = screen.getByRole('button', { name: /Move stop 3 down/i });
    expect(moveDownStop3).toBeDisabled();
    expect(moveUpStop3).not.toBeDisabled();

    await user.click(moveUpStop3);
    expect(handleReorderWaypoints).toHaveBeenCalledWith(2, 1);

    // Pick on map button
    const pickStop2 = screen.getByRole('button', { name: /Pick stop 2 on map/i });
    await user.click(pickStop2);
    expect(handleStartPlacingStop).toHaveBeenCalledWith(1);
  });
});
