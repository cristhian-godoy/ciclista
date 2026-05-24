import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { Sidebar } from './Sidebar';
import { DEFAULT_RULES_CONFIG } from './RulesConfigPanel';
import type { RouteAlternative, RouteResult } from '../core/router/types';

describe('Sidebar Integration', () => {
  const mockAlternatives: RouteAlternative[] = [
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
  ];

  const mockRouteResult: RouteResult = {
    totalDurationSeconds: 150,
    totalDistanceMeters: 600,
    signalCount: 1,
    yieldCount: 0,
    crossingCount: 0,
    coordinates: [],
    edges: [],
  };

  const defaultProps = {
    startCoord: null,
    endCoord: null,
    routeResult: mockRouteResult,
    routeAlternatives: mockAlternatives,
    routingStrategy: 'standard' as const,
    isFetchingOSM: false,
    onStrategyChange: vi.fn(),
    selectedPreset: 'munich' as const,
    onPresetChange: vi.fn(),
    rulesConfig: DEFAULT_RULES_CONFIG,
    onRulesChange: vi.fn(),
    bikeProfile: 'normal' as const,
    onBikeProfileChange: vi.fn(),
  };

  it('renders all mounted config and stats panels', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('Ciclista')).toBeInTheDocument();

    // Check elements from RoutingConfigPanel
    expect(screen.getByText('City Preset')).toBeInTheDocument();

    // Check elements from RouteStatsPanel
    expect(screen.getByText('Route Alternatives')).toBeInTheDocument();

    // Check elements from RulesConfigPanel
    expect(screen.getByText('Road Rules')).toBeInTheDocument();

    // Check elements from RouteComparePanel
    expect(screen.getByText('Route Comparison')).toBeInTheDocument();
  });

  it('delegates preset changes and strategy selections to parent callbacks', async () => {
    const user = userEvent.setup();
    const handlePresetChange = vi.fn();
    const handleStrategyChange = vi.fn();

    render(
      <Sidebar
        {...defaultProps}
        onPresetChange={handlePresetChange}
        onStrategyChange={handleStrategyChange}
      />,
    );

    // Test preset dropdown change
    await user.selectOptions(screen.getByRole('combobox'), 'amsterdam');
    expect(handlePresetChange).toHaveBeenCalledWith('amsterdam');

    // Test stats strategy card click
    const activeRouteCard = screen.getByText('⚡ Speed', { selector: 'span' });
    await user.click(activeRouteCard);
    expect(handleStrategyChange).toHaveBeenCalledWith('standard');
  });
});
