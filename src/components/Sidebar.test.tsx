import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_RULES_CONFIG } from '../core/config';
import type { Landmark } from '../core/landmarks/types';
import type { RouteResult, StrategyRouteVariant } from '../core/router/types';
import { StudioStateContext, type StudioStateContextType } from './map/MapContext';
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
    onSwapCoords: vi.fn(),
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

    expect(screen.getByRole('heading', { name: 'Routing' })).toBeInTheDocument();
    expect(screen.queryByText('Ciclista')).not.toBeInTheDocument();

    // Check elements from RoutingConfigPanel
    expect(screen.getByText('Route Points')).toBeInTheDocument();
    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('Destination')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Swap start and destination/i })).toBeInTheDocument();

    // Check elements from RouteStatsPanel
    expect(screen.getByText('Route Alternatives')).toBeInTheDocument();

    // Check elements from RulesConfigPanel
    expect(screen.getByText('Road Rules')).toBeInTheDocument();

    // Check elements from RouteComparePanel
    expect(screen.getByText('Route Comparison')).toBeInTheDocument();
  });

  it('delegates swap coordinates and strategy selections to parent callbacks', async () => {
    const user = userEvent.setup();
    const handleSwapCoords = vi.fn();
    const handleStrategyChange = vi.fn();

    render(
      <Sidebar
        {...defaultProps}
        onSwapCoords={handleSwapCoords}
        onStrategyChange={handleStrategyChange}
      />,
    );

    // Test swap button click
    const swapBtn = screen.getByRole('button', { name: /Swap start and destination/i });
    await user.click(swapBtn);
    expect(handleSwapCoords).toHaveBeenCalledTimes(1);

    // Test stats strategy card click
    const activeRouteCards = screen.getAllByText('Speed');
    const activeRouteCard = activeRouteCards[0];
    expect(activeRouteCard).toBeDefined();
    if (!activeRouteCard) return;
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

  it('swaps content to EventsPanel when in studio mode', () => {
    render(<Sidebar {...defaultProps} appMode="studio" selectedEdgeIds={['n1->n2']} />);

    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('1 road segment selected')).toBeInTheDocument();
    expect(screen.queryByText('Route Points')).not.toBeInTheDocument();
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

  it('swaps content to PlacesPanel when in places mode', () => {
    const mockPlaces = [
      {
        id: 'place-test-1',
        name: 'Home Sanctuary',
        category: 'home' as const,
        lat: 48.137,
        lng: 11.575,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    render(<Sidebar {...defaultProps} appMode="places" places={mockPlaces} />);

    expect(screen.getByRole('heading', { name: 'Places' })).toBeInTheDocument();
    expect(screen.getByText('Home Sanctuary')).toBeInTheDocument();
    expect(screen.queryByText('Route Alternatives')).not.toBeInTheDocument();
  });

  it('renders dynamic active section headers in sidebar-header for all panel modes without duplication', () => {
    // 1. Routing mode (default)
    const { unmount } = render(<Sidebar {...defaultProps} appMode="routing" />);
    expect(screen.getByRole('heading', { name: 'Routing' })).toBeInTheDocument();
    expect(screen.queryByText('Ciclista')).not.toBeInTheDocument();
    unmount();

    // 2. Places mode
    const { unmount: unmountPlaces } = render(<Sidebar {...defaultProps} appMode="places" />);
    expect(screen.getByRole('heading', { name: 'Places' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Landmarks & Favorites' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Ciclista')).not.toBeInTheDocument();
    unmountPlaces();

    // 3. Studio mode
    const { unmount: unmountStudio } = render(<Sidebar {...defaultProps} appMode="studio" />);
    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();
    expect(screen.queryByText('Ciclista')).not.toBeInTheDocument();
    unmountStudio();

    // 4. Edit mode
    const { unmount: unmountEdit } = render(<Sidebar {...defaultProps} appMode="edit" />);
    expect(screen.getByRole('heading', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByText('Ciclista')).not.toBeInTheDocument();
    unmountEdit();

    // 5. Debug mode
    render(<Sidebar {...defaultProps} appMode="debug" />);
    expect(screen.getByRole('heading', { name: 'Debug' })).toBeInTheDocument();
    expect(screen.queryByText('Ciclista')).not.toBeInTheDocument();
  });

  it('swaps content to CrossingEditPanel when in edit mode', () => {
    render(<Sidebar {...defaultProps} appMode="edit" />);

    expect(screen.getByRole('heading', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('Crossing Edge Classification')).toBeInTheDocument();
    expect(screen.getByText('Select a Crossing')).toBeInTheDocument();
    expect(screen.queryByText('Route Alternatives')).not.toBeInTheDocument();
  });

  it('renders mode-specific helper notes in sidebar-footer', () => {
    // 1. Routing mode footer note
    const { rerender } = render(<Sidebar {...defaultProps} appMode="routing" />);
    expect(
      screen.getByText('Drag green/red pins or right-click map to route.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Click red nodes to time stoplights.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Click junctions to configure turn paths or time stoplights.'),
    ).not.toBeInTheDocument();

    // 2. Edit mode footer note
    rerender(<Sidebar {...defaultProps} appMode="edit" />);
    expect(
      screen.getByText('Click junctions to configure turn paths or time stoplights.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Drag green/red pins or right-click map to route.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Click red nodes to time stoplights.')).not.toBeInTheDocument();
  });

  it('renders DebugPanel and debug footer note when in debug mode', () => {
    render(<Sidebar {...defaultProps} appMode="debug" />);

    expect(screen.getByRole('heading', { name: 'Debug' })).toBeInTheDocument();
    expect(screen.getByText('Cached Chunks')).toBeInTheDocument();
    expect(screen.getByText('Route Edges')).toBeInTheDocument();
    expect(
      screen.getByText('Inspect cached network chunks or route edge costs.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Route Alternatives')).not.toBeInTheDocument();
  });

  it('wires places prop to RoutingConfigPanel and displays places in Start input dropdown', async () => {
    const user = userEvent.setup();
    const handleSetStartCoord = vi.fn();
    const mockPlaces: Landmark[] = [
      {
        id: 'place-home',
        name: 'Home Sanctuary',
        category: 'home',
        lat: 48.13715,
        lng: 11.5754,
        description: 'Main residence',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'place-work',
        name: 'Tech Campus',
        category: 'work',
        lat: 48.15,
        lng: 11.59,
        description: 'Office building',
        createdAt: 1001,
        updatedAt: 1001,
      },
    ];

    render(<Sidebar {...defaultProps} places={mockPlaces} onSetStartCoord={handleSetStartCoord} />);

    const startInput = screen.getByLabelText('Start');
    await user.click(startInput);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Home Sanctuary')).toBeInTheDocument();
    expect(screen.getByText('Tech Campus')).toBeInTheDocument();

    await user.click(screen.getByText('Home Sanctuary'));
    expect(handleSetStartCoord).toHaveBeenCalledWith({ lat: 48.13715, lng: 11.5754 });
  });

  it('wires places from StudioStateContext when places prop is omitted', async () => {
    const user = userEvent.setup();
    const mockPlaces: Landmark[] = [
      {
        id: 'place-home',
        name: 'Home Sanctuary',
        category: 'home',
        lat: 48.13715,
        lng: 11.5754,
        description: 'Main residence',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'place-work',
        name: 'Tech Campus',
        category: 'work',
        lat: 48.15,
        lng: 11.59,
        description: 'Office building',
        createdAt: 1001,
        updatedAt: 1001,
      },
    ];

    const mockStudioCtx = {
      places: mockPlaces,
      setPlaces: vi.fn(),
      selectedEdgeIds: [],
      setSelectedEdgeIds: vi.fn(),
      selectionTool: 'click' as const,
      setSelectionTool: vi.fn(),
      brushRadiusMeters: 50,
      setBrushRadiusMeters: vi.fn(),
      events: [],
      setEvents: vi.fn(),
      isPlacingPlace: false,
      setIsPlacingPlace: vi.fn(),
      placeModalState: { isOpen: false, landmark: null, initialCoordinates: null },
      setPlaceModalState: vi.fn(),
      activeZoneEventId: null,
      setActiveZoneEventId: vi.fn(),
      isDrawingZone: false,
      setIsDrawingZone: vi.fn(),
      isSelectingEventsEdges: false,
      setIsSelectingEventsEdges: vi.fn(),
      editingPlace: null,
      setEditingPlace: vi.fn(),
      onClearSelection: vi.fn(),
    } as unknown as StudioStateContextType;

    render(
      <StudioStateContext.Provider value={mockStudioCtx}>
        <Sidebar {...defaultProps} />
      </StudioStateContext.Provider>,
    );

    const endInput = screen.getByLabelText('Destination');
    await user.click(endInput);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Home Sanctuary')).toBeInTheDocument();
    expect(screen.getByText('Tech Campus')).toBeInTheDocument();
  });

  it('toggles active placement state when Pick on map buttons are clicked in Sidebar', async () => {
    const user = userEvent.setup();
    render(<Sidebar {...defaultProps} />);

    const pickStart = screen.getByRole('button', { name: /pick start on map/i });
    expect(pickStart).not.toHaveClass('ciclista-btn--active');
    await user.click(pickStart);
    expect(pickStart).toHaveClass('ciclista-btn--active');

    const pickEnd = screen.getByRole('button', { name: /pick destination on map/i });
    expect(pickEnd).not.toHaveClass('ciclista-btn--active');
    await user.click(pickEnd);
    expect(pickEnd).toHaveClass('ciclista-btn--active');
  });
});
