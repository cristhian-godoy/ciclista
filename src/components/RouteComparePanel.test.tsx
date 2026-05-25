import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { RouteAlternative } from '../core/router/types';
import { RouteComparePanel } from './RouteComparePanel';

describe('RouteComparePanel', () => {
  const mockAlternatives = [
    {
      label: 'standard',
      result: {
        totalDurationSeconds: 120,
        totalDistanceMeters: 1000,
        signalCount: 2,
        yieldCount: 1,
        crossingCount: 0,
        coordinates: [],
        edges: [],
        roadTypeTotals: {
          cycleway: 500,
          residential: 300,
          primary: 200,
        },
        surfaceTotals: {
          paved: 900,
          gravel: 100,
          cobblestone: 0,
        },
      },
    },
    {
      label: 'avoid-stops',
      result: {
        totalDurationSeconds: 180,
        totalDistanceMeters: 1200,
        signalCount: 0,
        yieldCount: 0,
        crossingCount: 1,
        coordinates: [],
        edges: [],
        roadTypeTotals: {
          cycleway: 1200,
          residential: 0,
          primary: 0,
        },
        surfaceTotals: {
          paved: 1200,
          gravel: 0,
          cobblestone: 0,
        },
      },
    },
  ] as unknown as RouteAlternative[];

  it('renders placeholder when no alternatives exist', () => {
    render(
      <RouteComparePanel
        routeAlternatives={[]}
        activeAlternativeLabel="standard"
        onSelectAlternative={vi.fn()}
      />,
    );

    expect(screen.getByText('Route Comparison')).toBeInTheDocument();
    expect(screen.getByText(/No routes calculated yet/i)).toBeInTheDocument();
  });

  it('renders comparison table and checks metric display values', () => {
    render(
      <RouteComparePanel
        routeAlternatives={mockAlternatives}
        activeAlternativeLabel="standard"
        onSelectAlternative={vi.fn()}
      />,
    );

    expect(screen.getByText('Metric')).toBeInTheDocument();
    expect(screen.getByText('Time Predict')).toBeInTheDocument();
    expect(screen.getByText('Distance')).toBeInTheDocument();

    // Standard time: 120s => 2m 0s
    expect(screen.getByText('2m 0s')).toBeInTheDocument();
    // Avoid-Stops time: 180s => 3m 0s
    expect(screen.getByText('3m 0s')).toBeInTheDocument();

    // Standard distance: 1000m => 1.00 km
    expect(screen.getByText('1.00 km')).toBeInTheDocument();
    // Avoid-stops distance: 1200m => 1.20 km
    expect(screen.getByText('1.20 km')).toBeInTheDocument();

    // Signals: 2 vs 0
    expect(screen.getByText('Traffic Lights')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);

    // Percentages: standard cycleway (500/1000) => 50%
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Surface percentages
    expect(screen.getByText('% Paved')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('% Gravel')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('% Cobble')).toBeInTheDocument();
  });

  it('triggers onSelectAlternative when clicking on strategy header', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <RouteComparePanel
        routeAlternatives={mockAlternatives}
        activeAlternativeLabel="standard"
        onSelectAlternative={handleSelect}
      />,
    );

    const stopsHeader = screen.getByRole('columnheader', { name: /Stops/i });
    await user.click(stopsHeader);

    expect(handleSelect).toHaveBeenCalledWith('avoid-stops');
  });
});
