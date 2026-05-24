import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { RouteStatsPanel } from './RouteStatsPanel';
import type { RouteAlternative, RouteResult } from '../core/router/types';

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
  ] as unknown as RouteAlternative[];

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
        routeAlternatives={mockAlternatives}
        routingStrategy="standard"
        onStrategyChange={vi.fn()}
        routeResult={mockRouteResult}
      />,
    );

    // 150s => 2m 30s
    expect(screen.getByText('⚡ Speed')).toBeInTheDocument();
    expect(screen.getByText('⏱️ 2m 30s')).toBeInTheDocument();
    expect(screen.getByText('📏 600 m')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    expect(screen.getByText('🛑 Avoid Stops')).toBeInTheDocument();
  });

  it('triggers onStrategyChange when clicking another strategy card', async () => {
    const user = userEvent.setup();
    const handleStrategyChange = vi.fn();

    render(
      <RouteStatsPanel
        routeAlternatives={mockAlternatives}
        routingStrategy="standard"
        onStrategyChange={handleStrategyChange}
        routeResult={mockRouteResult}
      />,
    );

    const avoidStopsCard = screen.getByText('🛑 Avoid Stops');
    await user.click(avoidStopsCard);

    expect(handleStrategyChange).toHaveBeenCalledWith('avoid-stops');
  });

  it('reveals and collapses debug edges section when clicked', async () => {
    const user = userEvent.setup();
    render(
      <RouteStatsPanel
        routeAlternatives={mockAlternatives}
        routingStrategy="standard"
        onStrategyChange={vi.fn()}
        routeResult={mockRouteResult}
      />,
    );

    expect(screen.queryByText('1. Main Street')).not.toBeInTheDocument();

    const debugHeader = screen.getByText(/Debug Route Edges/i);
    await user.click(debugHeader);

    expect(screen.getByText('1. Main Street')).toBeInTheDocument();
    expect(screen.getByText('2. Side Street')).toBeInTheDocument();
  });
});
