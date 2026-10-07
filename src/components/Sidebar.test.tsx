import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_RULES_CONFIG } from '../core/config';
import type { RouteResult, StrategyRouteVariant } from '../core/router/types';
import { Sidebar } from './Sidebar';

describe('Sidebar Integration', () => {
  const mockAlternatives: StrategyRouteVariant[] = [
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
    routeVariants: mockAlternatives,
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

  it('swaps content to EventManagementPanel when in studio mode', () => {
    render(<Sidebar {...defaultProps} appMode="studio" selectedEdgeIds={['n1->n2']} />);

    expect(screen.getByText('Studio: Event Management')).toBeInTheDocument();
    expect(screen.getByText('1 road segment selected')).toBeInTheDocument();
    expect(screen.queryByText('City Preset')).not.toBeInTheDocument();
    expect(screen.queryByText('Route Alternatives')).not.toBeInTheDocument();
    expect(
      screen.getByText('Click or drag brush on roads to select and configure blockages.'),
    ).toBeInTheDocument();
  });

  it('triggers event creation callback in studio mode', async () => {
    const user = userEvent.setup();
    const handleCreateEvent = vi.fn();

    render(
      <Sidebar
        {...defaultProps}
        appMode="studio"
        selectedEdgeIds={['n1->n2', 'n2->n3']}
        onCreateEvent={handleCreateEvent}
      />,
    );

    const nameInput = screen.getByLabelText('Event Name');
    await user.type(nameInput, 'City Marathon');

    const submitBtn = screen.getByRole('button', { name: /Apply Road Blockage to Selection/i });
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    expect(handleCreateEvent).toHaveBeenCalledWith('City Marathon', undefined);
  });

  it('triggers event toggle and deletion callbacks in studio mode', async () => {
    const user = userEvent.setup();
    const handleToggleEvent = vi.fn();
    const handleDeleteEvent = vi.fn();

    const mockEvents = [
      {
        id: 'event-1',
        name: 'Blockage 1',
        active: true,
        edgeIds: ['n1->n2'],
        effect: { type: 'road_blockage' as const, penaltySeconds: 30 },
        createdAt: 1000,
      },
    ];

    render(
      <Sidebar
        {...defaultProps}
        appMode="studio"
        events={mockEvents}
        onToggleEvent={handleToggleEvent}
        onDeleteEvent={handleDeleteEvent}
      />,
    );

    expect(screen.getByText('Blockage 1')).toBeInTheDocument();

    const toggleCheckbox = screen.getByRole('checkbox', { name: /Toggle Blockage 1/i });
    await user.click(toggleCheckbox);
    expect(handleToggleEvent).toHaveBeenCalledWith('event-1');

    const deleteBtn = screen.getByRole('button', { name: /Delete Blockage 1/i });
    await user.click(deleteBtn);
    expect(handleDeleteEvent).toHaveBeenCalledWith('event-1');
  });

  it('swaps content to LandmarksPanel when in landmarks mode', () => {
    const mockLandmarks = [
      {
        id: 'lm-test-1',
        name: 'Home Sanctuary',
        category: 'home' as const,
        lat: 48.137,
        lng: 11.575,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    render(<Sidebar {...defaultProps} appMode="landmarks" landmarks={mockLandmarks} />);

    expect(screen.getByRole('heading', { name: 'Landmarks & Favorites' })).toBeInTheDocument();
    expect(screen.getByText('Home Sanctuary')).toBeInTheDocument();
    expect(screen.queryByText('Route Alternatives')).not.toBeInTheDocument();
  });
});
