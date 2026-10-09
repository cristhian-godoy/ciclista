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
});
