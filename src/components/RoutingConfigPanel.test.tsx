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
});
