import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_RULES_CONFIG } from '../core/router/rules';
import type { RouteAlternative, RouteResult } from '../core/router/types';
import { Sidebar } from './Sidebar';

describe('Sidebar Integration', () => {
  const mockAlternatives: RouteAlternative[] = [
    {
      label: 'standard',
      result: {
        pathNodeIds: [],
        totalDurationSeconds: 150,
        totalDistanceMeters: 600,
        streets: [],
        trafficSignalsCount: 0,
        signalCount: 1,
        yieldCount: 0,
        crossingCount: 0,
        roadTypeTotals: {},
        surfaceTotals: { paved: 600, gravel: 0, cobblestone: 0 },
        coordinates: [],
        edges: [],
      },
    },
  ];

  const mockRouteResult: RouteResult = {
    pathNodeIds: [],
    totalDurationSeconds: 150,
    totalDistanceMeters: 600,
    streets: [],
    trafficSignalsCount: 0,
    signalCount: 1,
    yieldCount: 0,
    crossingCount: 0,
    roadTypeTotals: {},
    surfaceTotals: { paved: 600, gravel: 0, cobblestone: 0 },
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
    bikeConfig: { id: 'normal' as const },
    onBikeConfigChange: vi.fn(),
    theme: 'bright' as const,
    onThemeChange: vi.fn(),
    isNavigating: false,
    onStartNavigation: vi.fn(),
    onStopNavigation: vi.fn(),
    navigationProgress: null,
    onToggleCameraMode: vi.fn(),
    cameraMode: 'heading-up' as const,
    isInspectorModeActive: false,
    selectedNodeId: null,
    onToggleInspectorMode: vi.fn(),
    onSelectNodeId: vi.fn(),
    selectedAlternativeTargetId: null,
    setSelectedAlternativeTargetId: vi.fn(),
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
    await user.selectOptions(screen.getByRole('combobox', { name: /City Preset/i }), 'amsterdam');
    expect(handlePresetChange).toHaveBeenCalledWith('amsterdam');

    // Test stats strategy card click
    const activeRouteCard = screen.getAllByText('Speed')[0];
    await user.click(activeRouteCard);
    expect(handleStrategyChange).toHaveBeenCalledWith('standard');
  });

  it('toggles collapse class and aria attributes on button click', async () => {
    const user = userEvent.setup();
    const { container } = render(<Sidebar {...defaultProps} />);

    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    const sidebarElement = container.querySelector('.sidebar');

    expect(sidebarElement).not.toHaveClass('collapsed');
    expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar');

    await user.click(toggleButton);
    expect(sidebarElement).toHaveClass('collapsed');
    expect(toggleButton).toHaveAttribute('aria-label', 'Expand sidebar');

    await user.click(toggleButton);
    expect(sidebarElement).not.toHaveClass('collapsed');
    expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar');
  });
});
