import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { RouteResult, StrategyRouteVariant } from '../core/router/types';
import { RouteStatsPanel } from './RouteStatsPanel';

describe('RouteStatsPanel', () => {
  const mockAlternatives = [
    {
      label: 'standard',
      result: {
        totalDurationSeconds: 150,
        totalDistanceMeters: 600,
        signalCount: 1,
        yieldCount: 0,
        crossingCount: 0,
        coordinates: [],
        edges: [],
      },
    },
    {
      label: 'avoid-stops',
      result: {
        totalDurationSeconds: 200,
        totalDistanceMeters: 800,
        signalCount: 0,
        yieldCount: 1,
        crossingCount: 1,
        coordinates: [],
        edges: [],
      },
    },
  ] as unknown as StrategyRouteVariant[];

  const mockRouteResult = {
    totalDurationSeconds: 150,
    totalDistanceMeters: 600,
    signalCount: 1,
    yieldCount: 0,
    crossingCount: 0,
    coordinates: [],
    edges: [
      {
        name: 'Main Street',
        highway: 'cycleway',
        distance: 400,
        cost: 90,
        tags: { surface: 'asphalt' },
      },
      {
        name: 'Side Street',
        highway: 'residential',
        distance: 200,
        cost: 60,
        tags: {},
      },
    ],
  } as unknown as RouteResult;

  it('renders alternative strategies and their formatted values', () => {
    render(
      <RouteStatsPanel
        routeVariants={mockAlternatives}
        routingStrategy="standard"
        onStrategyChange={vi.fn()}
        routeResult={mockRouteResult}
        isNavigating={false}
      />,
    );

    // 150s => 2m 30s
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('2m 30s')).toBeInTheDocument();
    expect(screen.getByText('600 m')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    expect(screen.getByText('Avoid Stops')).toBeInTheDocument();
  });

  it('triggers onStrategyChange when clicking another strategy card', async () => {
    const user = userEvent.setup();
    const handleStrategyChange = vi.fn();

    render(
      <RouteStatsPanel
        routeVariants={mockAlternatives}
        routingStrategy="standard"
        onStrategyChange={handleStrategyChange}
        routeResult={mockRouteResult}
        isNavigating={false}
      />,
    );

    const avoidStopsCard = screen.getByText('Avoid Stops');
    await user.click(avoidStopsCard);

    expect(handleStrategyChange).toHaveBeenCalledWith('avoid-stops');
  });

  it('reveals and collapses debug edges section when clicked', async () => {
    const user = userEvent.setup();
    render(
      <RouteStatsPanel
        routeVariants={mockAlternatives}
        routingStrategy="standard"
        onStrategyChange={vi.fn()}
        routeResult={mockRouteResult}
        isNavigating={false}
      />,
    );

    expect(screen.queryByText('1. Main Street')).not.toBeInTheDocument();

    const debugHeader = screen.getByText(/Debug Route Edges/i);
    await user.click(debugHeader);

    expect(screen.getByText('1. Main Street')).toBeInTheDocument();
    expect(screen.getByText('2. Side Street')).toBeInTheDocument();
  });

  it('does not trigger onStrategyChange when clicking strategies while navigating', async () => {
    const user = userEvent.setup();
    const handleStrategyChange = vi.fn();

    render(
      <RouteStatsPanel
        routeVariants={mockAlternatives}
        routingStrategy="standard"
        onStrategyChange={handleStrategyChange}
        routeResult={mockRouteResult}
        isNavigating={true}
      />,
    );

    const avoidStopsCard = screen.getByText('Avoid Stops');
    await user.click(avoidStopsCard);

    expect(handleStrategyChange).not.toHaveBeenCalled();
  });
});
