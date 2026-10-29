import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CrossingTurnOverride } from '../core/config/types';
import type { StreetGraph } from '../core/graph/types';
import { CrossingEditPanel } from './CrossingEditPanel';
import { MapContext, type MapContextType } from './map/MapContext';

describe('CrossingEditPanel Component', () => {
  const mockGraph: StreetGraph = {
    nodes: new Map([
      [
        'node-1',
        {
          node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: { highway: 'traffic_signals' } },
          edges: [
            {
              target: 'node-2',
              distance: 25,
              name: 'Bike Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
          ],
        },
      ],
      [
        'node-2',
        {
          node: { id: 'node-2', lat: 48.1372, lng: 11.5752, tags: { highway: 'traffic_signals' } },
          edges: [
            {
              target: 'node-1',
              distance: 25,
              name: 'Bike Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
          ],
        },
      ],
    ]),
  };

  const createMockContext = (overrides?: Partial<MapContextType>): MapContextType => ({
    map: null,
    setMap: vi.fn(),
    mapReady: true,
    setMapReady: vi.fn(),
    graph: mockGraph,
    loadedBBoxes: [],
    startCoord: null,
    endCoord: null,
    routeVariants: [],
    activeAlternativeLabel: 'standard',
    onSelectAlternative: vi.fn(),
    customNodeDelays: new Map(),
    customNodeNotes: new Map(),
    customNodeTurns: new Map(),
    selectedNode: null,
    onStartDrag: vi.fn(),
    onEndDrag: vi.fn(),
    onNodeSelect: vi.fn(),
    onSaveNodeOverride: vi.fn(),
    onSaveNodeTurns: vi.fn(),
    onClearNodeOverride: vi.fn(),
    theme: 'bright',
    isInspectorModeActive: false,
    onToggleInspectorMode: vi.fn(),
    selectedNodeId: null,
    setSelectedNodeId: vi.fn(),
    selectedAlternativeTargetId: null,
    setSelectedAlternativeTargetId: vi.fn(),
    inspectorBranches: [],
    shouldFitBounds: false,
    setShouldFitBounds: vi.fn(),
    showMinorControls: true,
    setShowMinorControls: vi.fn(),
    dockExpanded: true,
    setDockExpanded: vi.fn(),
    managedClusterId: null,
    setManagedClusterId: vi.fn(),
    managedNodeIds: [],
    setManagedNodeIds: vi.fn(),
    contextMenu: {
      visible: false,
      x: 0,
      y: 0,
      lng: 0,
      lat: 0,
      crossingId: null,
      nodeIds: null,
    },
    setContextMenu: vi.fn(),
    navigationState: {
      status: 'idle',
      cameraMode: 'heading-up',
      snapped: null,
      raw: null,
      progress: null,
      routeCoordinates: [],
      startTimestamp: null,
    },
    isNavigating: false,
    rideStats: null,
    onStopNavigation: vi.fn(),
    appMode: 'edit',
    setAppMode: vi.fn(),
    places: [],
    setPlaces: vi.fn(),
    landmarks: [],
    setLandmarks: vi.fn(),
    selectedEdgeIds: [],
    setSelectedEdgeIds: vi.fn(),
    selectionTool: 'click',
    setSelectionTool: vi.fn(),
    brushRadius: 40,
    setBrushRadius: vi.fn(),
    events: [],
    setEvents: vi.fn(),
    onClearSelection: vi.fn(),
    activeCrossingId: null,
    setActiveCrossingId: vi.fn(),
    activeTurnSelection: { fromNodeId: null, toNodeId: null, waypointNodeIds: [] },
    setActiveTurnSelection: vi.fn(),
    crossingTurns: [],
    onSaveCrossingTurn: vi.fn(),
    onDeleteCrossingTurn: vi.fn(),
    ...overrides,
  });

  it('renders edge classification legend and empty state when no crossing is selected', () => {
    const ctx = createMockContext();
    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    expect(screen.getByText('Crossing Edge Classification')).toBeInTheDocument();
    expect(screen.getByText('Cycleway')).toBeInTheDocument();
    expect(screen.getByText('Residential')).toBeInTheDocument();
    expect(screen.getByText('Pedestrian')).toBeInTheDocument();
    expect(screen.getByText('Arterial')).toBeInTheDocument();
    expect(screen.getByText('Select a Crossing')).toBeInTheDocument();
  });

  it('renders crossing summary and turn configuration when active crossing is set', () => {
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: 'node-2', waypointNodeIds: [] },
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    expect(screen.getByText(/Crossing #node-1/)).toBeInTheDocument();
    expect(screen.getByText(/From:/)).toBeInTheDocument();
    expect(screen.getByText(/Node #node-1/)).toBeInTheDocument();
    expect(screen.getByText(/To:/)).toBeInTheDocument();
    expect(screen.getByText(/Node #node-2/)).toBeInTheDocument();
    expect(screen.getByText('Time Delta Penalty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Turn Override/i })).toBeEnabled();
  });

  it('saves turn override when Save Turn Override button is clicked', async () => {
    const user = userEvent.setup();
    const handleSaveCrossingTurn = vi.fn();
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: 'node-2', waypointNodeIds: [] },
      onSaveCrossingTurn: handleSaveCrossingTurn,
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    const saveBtn = screen.getByRole('button', { name: /Save Turn Override/i });
    await user.click(saveBtn);

    expect(handleSaveCrossingTurn).toHaveBeenCalledTimes(1);
    expect(handleSaveCrossingTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        crossingId: 'crossing-node-1',
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        timeDeltaSeconds: 0,
        banned: false,
        turnType: 'direct',
      }),
    );
  });

  it('allows toggling ban and selecting turn type tags', async () => {
    const user = userEvent.setup();
    const handleSaveCrossingTurn = vi.fn();
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: 'node-2', waypointNodeIds: [] },
      onSaveCrossingTurn: handleSaveCrossingTurn,
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    const banCheckbox = screen.getByRole('checkbox');
    await user.click(banCheckbox);

    const copenhagenBtn = screen.getByRole('button', { name: 'Copenhagen Two-Stage' });
    await user.click(copenhagenBtn);

    const saveBtn = screen.getByRole('button', { name: /Save Turn Override/i });
    await user.click(saveBtn);

    expect(handleSaveCrossingTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        banned: true,
        turnType: 'copenhagen_two_stage',
      }),
    );
  });

  it('displays existing overrides and allows deleting them', async () => {
    const user = userEvent.setup();
    const handleDeleteCrossingTurn = vi.fn();
    const savedTurn: CrossingTurnOverride = {
      id: 'turn-1',
      crossingId: 'crossing-node-1',
      fromNodeId: 'node-1',
      toNodeId: 'node-2',
      timeDeltaSeconds: 15,
      banned: false,
      turnType: 'direct',
    };

    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      crossingTurns: [savedTurn],
      onDeleteCrossingTurn: handleDeleteCrossingTurn,
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    expect(screen.getByText('Saved Overrides (1)')).toBeInTheDocument();
    expect(screen.getByText('#node-1 → #node-2')).toBeInTheDocument();
    expect(screen.getByText('+15s')).toBeInTheDocument();

    const deleteBtn = screen.getByTitle('Delete override');
    await user.click(deleteBtn);

    expect(handleDeleteCrossingTurn).toHaveBeenCalledWith('turn-1');
  });

  it('synchronizes form state when active turn selection matches an existing override', () => {
    const savedTurn: CrossingTurnOverride = {
      id: 'turn-custom',
      crossingId: 'crossing-node-1',
      fromNodeId: 'node-1',
      toNodeId: 'node-2',
      timeDeltaSeconds: 22,
      banned: true,
      turnType: 'copenhagen_two_stage',
      description: 'Avoid during peak traffic',
      pathNodeIds: ['node-1', 'node-2'],
    };

    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: 'node-2', waypointNodeIds: [] },
      crossingTurns: [savedTurn],
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    const banCheckbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(banCheckbox.checked).toBe(true);

    const copenhagenBtn = screen.getByRole('button', { name: 'Copenhagen Two-Stage' });
    expect(copenhagenBtn.className).toContain('active');

    expect(screen.getByText('+22s')).toBeInTheDocument();
  });

  it('resets form state when selecting a turn without an existing override', () => {
    const savedTurn: CrossingTurnOverride = {
      id: 'turn-existing',
      crossingId: 'crossing-node-1',
      fromNodeId: 'node-1',
      toNodeId: 'node-2',
      timeDeltaSeconds: 25,
      banned: true,
      turnType: 'green_arrow',
    };

    // Render with existing override
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: 'node-2', waypointNodeIds: [] },
      crossingTurns: [savedTurn],
    });

    const { rerender } = render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);

    // Switch selection to a new pair without override
    const updatedCtx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-2', toNodeId: 'node-1', waypointNodeIds: [] },
      crossingTurns: [savedTurn],
    });

    rerender(
      <MapContext.Provider value={updatedCtx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('0s')).toBeInTheDocument();
    const directBtn = screen.getByRole('button', { name: 'Direct' });
    expect(directBtn.className).toContain('active');
  });

  it('renders Clear Selection button when turn selection is dirty and calls onClearSelection on click', async () => {
    const user = userEvent.setup();
    const handleSetActiveTurnSelection = vi.fn();
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: null, waypointNodeIds: [] },
      setActiveTurnSelection: handleSetActiveTurnSelection,
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    const clearBtn = screen.getByRole('button', { name: /Clear Selection/i });
    expect(clearBtn).toBeInTheDocument();

    await user.click(clearBtn);

    expect(handleSetActiveTurnSelection).toHaveBeenCalledWith({
      fromNodeId: null,
      toNodeId: null,
      waypointNodeIds: [],
    });
  });

  it('does NOT render Clear Selection button when turn selection is clean', () => {
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: null, toNodeId: null, waypointNodeIds: [] },
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    expect(screen.queryByRole('button', { name: /Clear Selection/i })).not.toBeInTheDocument();
  });

  it('clears dirty turn selection when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const handleSetActiveTurnSelection = vi.fn();
    const handleSetActiveCrossingId = vi.fn();
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: 'node-2', waypointNodeIds: [] },
      setActiveTurnSelection: handleSetActiveTurnSelection,
      setActiveCrossingId: handleSetActiveCrossingId,
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    await user.keyboard('{Escape}');

    expect(handleSetActiveTurnSelection).toHaveBeenCalledWith({
      fromNodeId: null,
      toNodeId: null,
      waypointNodeIds: [],
    });
    expect(handleSetActiveCrossingId).not.toHaveBeenCalled();
  });

  it('deselects crossing when Escape key is pressed with clean turn selection', async () => {
    const user = userEvent.setup();
    const handleSetActiveCrossingId = vi.fn();
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: null, toNodeId: null, waypointNodeIds: [] },
      setActiveCrossingId: handleSetActiveCrossingId,
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    await user.keyboard('{Escape}');

    expect(handleSetActiveCrossingId).toHaveBeenCalledWith(null);
  });

  it('renders segmented sub-mode toggle and switches between paths and signals', async () => {
    const user = userEvent.setup();
    const handleSetEditSubMode = vi.fn();
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      editSubMode: 'paths',
      setEditSubMode: handleSetEditSubMode,
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    expect(screen.getByRole('button', { name: /Turn Paths/i })).toBeInTheDocument();
    const signalsBtn = screen.getByRole('button', { name: /Traffic Signals/i });
    expect(signalsBtn).toBeInTheDocument();

    await user.click(signalsBtn);
    expect(handleSetEditSubMode).toHaveBeenCalledWith('signals');
  });

  it('renders signal configuration overview and suppresses turn path form in signals sub-mode', () => {
    const customDelays = new Map([['node-1', 12]]);
    const ctx = createMockContext({
      activeCrossingId: 'crossing-node-1',
      editSubMode: 'signals',
      customNodeDelays: customDelays,
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    expect(screen.getByText(/Intersection #node-1/)).toBeInTheDocument();
    expect(screen.getByText('Signal Configuration')).toBeInTheDocument();
    expect(screen.getByText(/Click an unclustered signal on the map/i)).toBeInTheDocument();
    expect(screen.getByText('Signal #node-1')).toBeInTheDocument();
    expect(screen.getByText('+12s')).toBeInTheDocument();
    expect(screen.queryByText('Crossing Edge Classification')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Turn Override/i })).not.toBeInTheDocument();
  });

  it('renders select an intersection empty state in signals sub-mode when no crossing is active', () => {
    const ctx = createMockContext({
      activeCrossingId: null,
      editSubMode: 'signals',
    });

    render(
      <MapContext.Provider value={ctx}>
        <CrossingEditPanel />
      </MapContext.Provider>,
    );

    expect(screen.getByText('Select an Intersection')).toBeInTheDocument();
    expect(screen.queryByText('Crossing Edge Classification')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Turn Override/i })).not.toBeInTheDocument();
  });
});
