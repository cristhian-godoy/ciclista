import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';
import { SelectionToolsDock } from './SelectionToolsDock';

describe('SelectionToolsDock', () => {
  const createDefaultContext = (overrides: Partial<MapContextType> = {}): MapContextType => ({
    map: null,
    setMap: vi.fn(),
    mapReady: true,
    setMapReady: vi.fn(),
    graph: null,
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
    showMinorControls: false,
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
      cameraMode: 'north-up',
      snapped: null,
      raw: null,
      progress: null,
      routeCoordinates: [],
      startTimestamp: null,
    },
    isNavigating: false,
    rideStats: null,
    onStopNavigation: vi.fn(),
    appMode: 'studio',
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
    ...overrides,
  });

  it('renders null when appMode is routing', () => {
    const context = createDefaultContext({ appMode: 'routing' });
    const { container } = render(
      <MapContext.Provider value={context}>
        <SelectionToolsDock />
      </MapContext.Provider>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dock with tool buttons and selection count in studio mode', () => {
    const context = createDefaultContext({
      appMode: 'studio',
      selectedEdgeIds: ['edge-1', 'edge-2'],
    });

    render(
      <MapContext.Provider value={context}>
        <SelectionToolsDock />
      </MapContext.Provider>,
    );

    expect(screen.getByRole('toolbar', { name: 'Map Selection Tools' })).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Click Selection' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Radius Brush Selection' })).toBeInTheDocument();
  });

  it('toggles selection tools on button click', async () => {
    const user = userEvent.setup();
    const setSelectionToolMock = vi.fn();
    const context = createDefaultContext({
      appMode: 'studio',
      selectionTool: 'click',
      setSelectionTool: setSelectionToolMock,
    });

    render(
      <MapContext.Provider value={context}>
        <SelectionToolsDock />
      </MapContext.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Radius Brush Selection' }));
    expect(setSelectionToolMock).toHaveBeenCalledWith('brush');
  });

  it('renders brush radius controls and quick buttons when brush tool is active', async () => {
    const user = userEvent.setup();
    const setBrushRadiusMock = vi.fn();
    const context = createDefaultContext({
      appMode: 'studio',
      selectionTool: 'brush',
      brushRadius: 40,
      setBrushRadius: setBrushRadiusMock,
    });

    render(
      <MapContext.Provider value={context}>
        <SelectionToolsDock />
      </MapContext.Provider>,
    );

    expect(screen.getByTestId('brush-controls')).toBeInTheDocument();
    expect(screen.getByText('Radius: 40m')).toBeInTheDocument();

    const slider = screen.getByLabelText('Brush Radius Slider');
    fireEvent.change(slider, { target: { value: '60' } });
    expect(setBrushRadiusMock).toHaveBeenCalledWith(60);

    await user.click(screen.getByRole('button', { name: 'Quick radius 25m' }));
    expect(setBrushRadiusMock).toHaveBeenCalledWith(25);

    await user.click(screen.getByRole('button', { name: 'Quick radius 50m' }));
    expect(setBrushRadiusMock).toHaveBeenCalledWith(50);

    await user.click(screen.getByRole('button', { name: 'Quick radius 100m' }));
    expect(setBrushRadiusMock).toHaveBeenCalledWith(100);
  });

  it('triggers onClearSelection when clear button is clicked', async () => {
    const user = userEvent.setup();
    const onClearSelectionMock = vi.fn();
    const context = createDefaultContext({
      appMode: 'studio',
      selectedEdgeIds: ['edge-1'],
      onClearSelection: onClearSelectionMock,
    });

    render(
      <MapContext.Provider value={context}>
        <SelectionToolsDock />
      </MapContext.Provider>,
    );

    const clearBtn = screen.getByRole('button', { name: 'Clear Selection' });
    await user.click(clearBtn);
    expect(onClearSelectionMock).toHaveBeenCalledTimes(1);
  });
});
