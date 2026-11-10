import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Landmark } from '../core/landmarks/types';
import { RoutingConfigPanel } from './RoutingConfigPanel';

const mockPlaces: Landmark[] = [
  {
    id: 'place-home',
    name: 'Home',
    category: 'home',
    lat: 48.13715,
    lng: 11.5754,
    description: 'My sweet home',
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: 'place-work',
    name: 'Work Office',
    category: 'work',
    lat: 48.15,
    lng: 11.59,
    description: 'Headquarters',
    createdAt: 1001,
    updatedAt: 1001,
  },
  {
    id: 'place-cafe',
    name: 'Central Cafe',
    category: 'shop',
    lat: 48.14,
    lng: 11.58,
    description: 'Coffee spot',
    createdAt: 1002,
    updatedAt: 1002,
  },
];

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

  it('displays autocomplete dropdown with saved places when input is focused', async () => {
    const user = userEvent.setup();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        places={mockPlaces}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const startInput = screen.getByLabelText('Start');
    await user.click(startInput);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Work Office')).toBeInTheDocument();
    expect(screen.getByText('Central Cafe')).toBeInTheDocument();
    expect(screen.getByText('48.13715, 11.57540')).toBeInTheDocument();
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
  });

  it('filters saved places by name, category, and description', async () => {
    const user = userEvent.setup();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        places={mockPlaces}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const startInput = screen.getByLabelText('Start');

    // Filter by name
    await user.type(startInput, 'Work');
    expect(screen.getByText('Work Office')).toBeInTheDocument();
    expect(screen.queryByText('Home')).not.toBeInTheDocument();

    // Filter by category
    await user.clear(startInput);
    await user.type(startInput, 'shop');
    expect(screen.getByText('Central Cafe')).toBeInTheDocument();
    expect(screen.queryByText('Work Office')).not.toBeInTheDocument();

    // Filter by description
    await user.clear(startInput);
    await user.type(startInput, 'Coffee spot');
    expect(screen.getByText('Central Cafe')).toBeInTheDocument();
  });

  it('invokes onSetStartCoord when a place is clicked from dropdown and displays place name', async () => {
    const user = userEvent.setup();
    const handleSetStartCoord = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        places={mockPlaces}
        onSwapCoords={vi.fn()}
        onSetStartCoord={handleSetStartCoord}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const startInput = screen.getByLabelText('Start');
    await user.click(startInput);

    const homeOption = screen.getByText('Home');
    await user.click(homeOption);

    expect(handleSetStartCoord).toHaveBeenCalledWith({ lat: 48.13715, lng: 11.5754 });
    expect(startInput).toHaveValue('Home');
  });

  it('navigates dropdown with keyboard and selects place on Enter', async () => {
    const user = userEvent.setup();
    const handleSetEndCoord = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        places={mockPlaces}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={handleSetEndCoord}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const endInput = screen.getByLabelText('Destination');
    await user.click(endInput);

    await user.keyboard('{ArrowDown}{Enter}');
    expect(handleSetEndCoord).toHaveBeenCalledWith({ lat: 48.13715, lng: 11.5754 });
    expect(endInput).toHaveValue('Home');
  });

  it('dismisses dropdown on Escape key without mutating coordinates', async () => {
    const user = userEvent.setup();
    const handleSetStartCoord = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        places={mockPlaces}
        onSwapCoords={vi.fn()}
        onSetStartCoord={handleSetStartCoord}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const startInput = screen.getByLabelText('Start');
    await user.click(startInput);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(handleSetStartCoord).not.toHaveBeenCalled();
  });

  it('renders empty state message when no saved places exist or match query', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        places={[]}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const startInput = screen.getByLabelText('Start');
    await user.click(startInput);
    expect(screen.getByText('No saved places')).toBeInTheDocument();

    rerender(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        places={mockPlaces}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    await user.type(startInput, 'NonexistentQuery');
    expect(screen.getByText('No saved places found')).toBeInTheDocument();
  });

  it('supports clear button to reset endpoint coordinate and place', async () => {
    const user = userEvent.setup();
    const handleClearStart = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={{ lat: 48.13715, lng: 11.5754 }}
        endCoord={null}
        places={mockPlaces}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        onClearStartCoord={handleClearStart}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const clearBtn = screen.getByRole('button', { name: /clear start/i });
    expect(clearBtn).toBeInTheDocument();

    await user.click(clearBtn);
    expect(handleClearStart).toHaveBeenCalledTimes(1);
  });

  it('supports pick on map buttons and toggles active placement state', async () => {
    const user = userEvent.setup();
    const handlePickStart = vi.fn();
    const handlePickEnd = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        onPickStartOnMap={handlePickStart}
        onPickEndOnMap={handlePickEnd}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const pickStartBtn = screen.getByRole('button', { name: /pick start on map/i });
    const pickEndBtn = screen.getByRole('button', { name: /pick destination on map/i });

    expect(pickStartBtn).not.toHaveClass('ciclista-btn--active');
    expect(pickEndBtn).not.toHaveClass('ciclista-btn--active');

    await user.click(pickStartBtn);
    expect(handlePickStart).toHaveBeenCalledTimes(1);
    expect(pickStartBtn).toHaveClass('ciclista-btn--active');

    await user.click(pickEndBtn);
    expect(handlePickEnd).toHaveBeenCalledTimes(1);
    expect(pickEndBtn).toHaveClass('ciclista-btn--active');
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

  it('renders bike selector dropdown inside Route Points and does not render standalone bike profile section', () => {
    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const bikeSelect = screen.getByLabelText('Bike');
    expect(bikeSelect).toBeInTheDocument();
    expect(bikeSelect).toHaveValue('normal');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Normal Bike');
    expect(options[0]).toHaveValue('normal');
    expect(options[1]).toHaveTextContent('E-Bike');
    expect(options[1]).toHaveValue('ebike');

    // Standalone Bike Profile section and customize buttons must not exist
    expect(screen.queryByTestId('customize-bike-rules-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bike-profile-summary-pill')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bike Profile Selector')).not.toBeInTheDocument();
  });

  it('triggers onSelectBike and onBikeConfigChange when selecting another bike', async () => {
    const user = userEvent.setup();
    const handleBikeChange = vi.fn();
    const handleSelectBike = vi.fn();

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal', customSpeedKmh: 18 }}
        onBikeConfigChange={handleBikeChange}
        onSelectBike={handleSelectBike}
      />,
    );

    const bikeSelect = screen.getByLabelText('Bike');
    await user.selectOptions(bikeSelect, 'ebike');

    expect(handleSelectBike).toHaveBeenCalledWith('ebike');
    expect(handleBikeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ebike',
        customSpeedKmh: 25,
      }),
    );
  });

  it('supports custom bikes list and activeBikeId prop', async () => {
    const user = userEvent.setup();
    const handleBikeChange = vi.fn();
    const handleSelectBike = vi.fn();

    const customBikes = [
      { id: 'road' as const, name: 'Road Bike', speedKmh: 30 },
      { id: 'cargo' as const, name: 'Cargo Bike', speedKmh: 15 },
    ];

    render(
      <RoutingConfigPanel
        startCoord={null}
        endCoord={null}
        onSwapCoords={vi.fn()}
        onSetStartCoord={vi.fn()}
        onSetEndCoord={vi.fn()}
        isFetchingOSM={false}
        bikeConfig={{ id: 'road' }}
        bikes={customBikes}
        activeBikeId="road"
        onBikeConfigChange={handleBikeChange}
        onSelectBike={handleSelectBike}
      />,
    );

    const bikeSelect = screen.getByLabelText('Bike');
    expect(bikeSelect).toHaveValue('road');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Road Bike');
    expect(options[1]).toHaveTextContent('Cargo Bike');

    await user.selectOptions(bikeSelect, 'cargo');
    expect(handleSelectBike).toHaveBeenCalledWith('cargo');
    expect(handleBikeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cargo',
        customSpeedKmh: 15,
      }),
    );
  });

  it('supports multi-stop waypoints UI: add, remove, and read-only inputs', async () => {
    const user = userEvent.setup();
    const handleAddWaypoint = vi.fn();
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
        isFetchingOSM={false}
        bikeConfig={{ id: 'normal' }}
        onBikeConfigChange={vi.fn()}
      />,
    );

    const stopInput = screen.getByLabelText('Stop 1');
    expect(stopInput).toHaveValue('48.14000, 11.58000');
    expect(stopInput).toHaveAttribute('readonly');

    // Add stop button
    const addStopBtn = screen.getByRole('button', { name: /Add Stop/i });
    await user.click(addStopBtn);
    expect(handleAddWaypoint).toHaveBeenCalledWith();

    // Remove stop button
    const removeStopBtn = screen.getByRole('button', { name: /Remove stop 1/i });
    await user.click(removeStopBtn);
    expect(handleRemoveWaypoint).toHaveBeenCalledWith(0);
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
