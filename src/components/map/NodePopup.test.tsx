import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import maplibregl from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';

import type { GraphNode } from '../../core/graph/types';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';
import { NodePopup } from './NodePopup';

const defaultContextValue: MapContextType = {
  map: null,
  setMap: vi.fn(),
  mapReady: false,
  setMapReady: vi.fn(),
  graph: null,
  loadedBBoxes: [],
  startCoord: null,
  endCoord: null,
  routeAlternatives: [],
  activeAlternativeLabel: 'standard',
  onSelectAlternative: vi.fn(),
  selectedPreset: 'munich',
  customNodeDelays: new Map(),
  customNodeNotes: new Map(),
  selectedNode: null,
  onStartDrag: vi.fn(),
  onEndDrag: vi.fn(),
  onNodeSelect: vi.fn(),
  onSaveNodeOverride: vi.fn(),
  onClearNodeOverride: vi.fn(),
  theme: 'bright',
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
  isInspectorModeActive: false,
  selectedNodeId: null,
  setSelectedNodeId: vi.fn(),
  selectedAlternativeTargetId: null,
  setSelectedAlternativeTargetId: vi.fn(),
};

describe('NodePopup', () => {
  const mockNode: GraphNode = {
    id: 'node_123',
    lat: 48.13,
    lng: 11.57,
    tags: {
      highway: 'traffic_signals',
      crossing: 'traffic_signals',
      name: 'Central Crossing',
    },
  };

  it('renders nothing when selectedNode is null', () => {
    const contextValue: MapContextType = {
      ...defaultContextValue,
      map: new maplibregl.Map({ container: 'map' } as maplibregl.MapOptions),
      selectedNode: null,
      onNodeSelect: vi.fn(),
      customNodeDelays: new Map(),
      customNodeNotes: new Map(),
      onSaveNodeOverride: vi.fn(),
      onClearNodeOverride: vi.fn(),
      setDockExpanded: vi.fn(),
    };

    const { container } = render(
      <MapContext.Provider value={contextValue}>
        <NodePopup />
      </MapContext.Provider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders details, penalty, presets, and tags when selectedNode is provided', () => {
    const contextValue: MapContextType = {
      ...defaultContextValue,
      map: new maplibregl.Map({ container: 'map' } as maplibregl.MapOptions),
      selectedNode: mockNode,
      onNodeSelect: vi.fn(),
      customNodeDelays: new Map(),
      customNodeNotes: new Map(),
      onSaveNodeOverride: vi.fn(),
      onClearNodeOverride: vi.fn(),
      setDockExpanded: vi.fn(),
    };

    render(
      <MapContext.Provider value={contextValue}>
        <NodePopup />
      </MapContext.Provider>,
    );

    expect(screen.getByText('Configure Control Point')).toBeInTheDocument();
    expect(screen.getByText('Central Crossing')).toBeInTheDocument();
    expect(screen.getByText(/node_123/)).toBeInTheDocument();

    // Check presets for traffic signals are displayed
    expect(screen.getByRole('button', { name: 'Always Green' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Standard (15s)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Slow (30s)' })).toBeInTheDocument();

    // Check tags are shown
    expect(screen.getByText('highway')).toBeInTheDocument();
    expect(screen.getAllByText('traffic_signals').length).toBeGreaterThan(0);
  });

  it('calls setDockExpanded(false) on mount', async () => {
    const handleSetDock = vi.fn();
    const contextValue: MapContextType = {
      ...defaultContextValue,
      map: new maplibregl.Map({ container: 'map' } as maplibregl.MapOptions),
      selectedNode: mockNode,
      onNodeSelect: vi.fn(),
      customNodeDelays: new Map(),
      customNodeNotes: new Map(),
      onSaveNodeOverride: vi.fn(),
      onClearNodeOverride: vi.fn(),
      setDockExpanded: handleSetDock,
    };

    render(
      <MapContext.Provider value={contextValue}>
        <NodePopup />
      </MapContext.Provider>,
    );

    await waitFor(() => {
      expect(handleSetDock).toHaveBeenCalledWith(false);
    });
  });

  it('updates delay when clicking preset buttons and fires onSaveNodeOverride on Save', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    const handleNodeSelect = vi.fn();

    const contextValue: MapContextType = {
      ...defaultContextValue,
      map: new maplibregl.Map({ container: 'map' } as maplibregl.MapOptions),
      selectedNode: mockNode,
      onNodeSelect: handleNodeSelect,
      customNodeDelays: new Map(),
      customNodeNotes: new Map(),
      onSaveNodeOverride: handleSave,
      onClearNodeOverride: vi.fn(),
      setDockExpanded: vi.fn(),
    };

    render(
      <MapContext.Provider value={contextValue}>
        <NodePopup />
      </MapContext.Provider>,
    );

    // Initial delay is standard (15s) for traffic signals
    expect(screen.getByText(/Wait Penalty: 15 seconds/i)).toBeInTheDocument();

    // Click 'Slow (30s)' preset
    const slowPreset = screen.getByRole('button', { name: 'Slow (30s)' });
    await user.click(slowPreset);

    expect(screen.getByText(/Wait Penalty: 30 seconds/i)).toBeInTheDocument();

    // Enter custom notes
    const notesInput = screen.getByPlaceholderText(/Constant bus priority request/i);
    await user.type(notesInput, 'Priority phase');

    // Click Save
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    await user.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith('node_123', 30, 'Priority phase');
    expect(handleNodeSelect).toHaveBeenCalledWith(null);
  });

  it('renders Reset button and calls onClearNodeOverride when clicked', async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();
    const handleNodeSelect = vi.fn();

    const customDelays = new Map([['node_123', 45]]);

    const contextValue: MapContextType = {
      ...defaultContextValue,
      map: new maplibregl.Map({ container: 'map' } as maplibregl.MapOptions),
      selectedNode: mockNode,
      onNodeSelect: handleNodeSelect,
      customNodeDelays: customDelays,
      customNodeNotes: new Map(),
      onSaveNodeOverride: vi.fn(),
      onClearNodeOverride: handleClear,
      setDockExpanded: vi.fn(),
    };

    render(
      <MapContext.Provider value={contextValue}>
        <NodePopup />
      </MapContext.Provider>,
    );

    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    expect(resetBtn).toBeInTheDocument();

    await user.click(resetBtn);
    expect(handleClear).toHaveBeenCalledWith('node_123');
    expect(handleNodeSelect).toHaveBeenCalledWith(null);
  });

  it('updates delay when moving slider range', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

    const contextValue: MapContextType = {
      ...defaultContextValue,
      map: new maplibregl.Map({ container: 'map' } as maplibregl.MapOptions),
      selectedNode: mockNode,
      onNodeSelect: vi.fn(),
      customNodeDelays: new Map(),
      customNodeNotes: new Map(),
      onSaveNodeOverride: handleSave,
      onClearNodeOverride: vi.fn(),
      setDockExpanded: vi.fn(),
    };

    render(
      <MapContext.Provider value={contextValue}>
        <NodePopup />
      </MapContext.Provider>,
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '90' } });

    expect(screen.getByText(/Wait Penalty: 90 seconds/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    await user.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith('node_123', 90, '');
  });
});
