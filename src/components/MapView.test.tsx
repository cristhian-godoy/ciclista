import { render } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StreetGraph } from '../core/graph/types';
import type { MapContextType } from './map/MapContext';
import { MapContext } from './map/MapContext';
import { MapView } from './MapView';

describe('MapView Component', () => {
  let mockMap: Partial<maplibregl.Map>;
  let mockGraph: StreetGraph;
  let defaultContext: MapContextType;
  let setSelectedEdgeIdsMock: ReturnType<typeof vi.fn>;
  let setContextMenuMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setSelectedEdgeIdsMock = vi.fn();
    setContextMenuMock = vi.fn();

    mockMap = {
      on: vi.fn(),
      off: vi.fn(),
      getSource: vi.fn(() => undefined),
      addSource: vi.fn(),
      getLayer: vi.fn(() => undefined),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      setFilter: vi.fn(),
      setPaintProperty: vi.fn(),
      hasImage: vi.fn(() => true),
      addImage: vi.fn(),
      removeImage: vi.fn(),
      queryRenderedFeatures: vi.fn(() => []),
      dragPan: {
        enable: vi.fn(),
        disable: vi.fn(),
        isEnabled: vi.fn(),
      } as unknown as maplibregl.Map['dragPan'],
      dragRotate: {
        enable: vi.fn(),
        disable: vi.fn(),
        isEnabled: vi.fn(),
      } as unknown as maplibregl.Map['dragRotate'],
      getCanvas: vi.fn(() => ({ style: {} })) as unknown as () => HTMLCanvasElement,
    };

    const nodes = new Map();
    nodes.set('node-1', {
      node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: {} },
      edges: [{ target: 'node-2', distance: 100, tags: {} }],
    });
    nodes.set('node-2', {
      node: { id: 'node-2', lat: 48.138, lng: 11.576, tags: {} },
      edges: [{ target: 'node-1', distance: 100, tags: {} }],
    });
    mockGraph = { nodes };

    defaultContext = {
      map: mockMap as maplibregl.Map,
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
      setContextMenu: setContextMenuMock as unknown as MapContextType['setContextMenu'],
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
      setSelectedEdgeIds: setSelectedEdgeIdsMock as unknown as MapContextType['setSelectedEdgeIds'],
      selectionTool: 'click',
      setSelectionTool: vi.fn(),
      brushRadius: 40,
      setBrushRadius: vi.fn(),
      events: [],
      setEvents: vi.fn(),
      onClearSelection: vi.fn(),
      landmarkModal: {
        isOpen: false,
        landmark: null,
        initialCoordinates: null,
      },
      setLandmarkModal: vi.fn(),
      openCreateLandmarkModal: vi.fn(),
      openEditLandmarkModal: vi.fn(),
      closeLandmarkModal: vi.fn(),
      onCreateLandmark: vi.fn(),
      onUpdateLandmark: vi.fn(),
      onDeleteLandmark: vi.fn(),
    };
  });

  it('renders map wrapper and container element', () => {
    const { container } = render(
      <MapContext.Provider value={defaultContext}>
        <MapView />
      </MapContext.Provider>,
    );

    expect(container.querySelector('.map-wrapper')).toBeInTheDocument();
    expect(container.querySelector('.map-container')).toBeInTheDocument();
  });

  it('renders SelectionToolsDock when in studio mode', () => {
    const { container } = render(
      <MapContext.Provider value={defaultContext}>
        <MapView />
      </MapContext.Provider>,
    );

    expect(container.querySelector('.map-selection-dock')).toBeInTheDocument();
  });

  it('selects edges along brush drag path in studio brush mode', () => {
    const contextWithBrush = {
      ...defaultContext,
      selectionTool: 'brush' as const,
    };

    render(
      <MapContext.Provider value={contextWithBrush}>
        <MapView />
      </MapContext.Provider>,
    );

    const mouseDownHandler = (mockMap.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'mousedown',
    )?.[1];

    expect(mouseDownHandler).toBeDefined();

    mouseDownHandler({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.1375, lng: 11.575 },
      originalEvent: { button: 0, preventDefault: vi.fn() },
    });

    expect(setSelectedEdgeIdsMock).toHaveBeenCalled();
  });

  it('deselects edges along drag path with right mouse button in studio mode', () => {
    const preventDefaultMock = vi.fn();
    const contextWithBrush = {
      ...defaultContext,
      selectionTool: 'brush' as const,
      selectedEdgeIds: ['node-1->node-2'],
    };

    render(
      <MapContext.Provider value={contextWithBrush}>
        <MapView />
      </MapContext.Provider>,
    );

    const mouseDownHandler = (mockMap.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'mousedown',
    )?.[1];

    expect(mouseDownHandler).toBeDefined();

    mouseDownHandler({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.1375, lng: 11.575 },
      originalEvent: { button: 2, preventDefault: preventDefaultMock },
    });

    expect(preventDefaultMock).toHaveBeenCalled();
    expect(setSelectedEdgeIdsMock).toHaveBeenCalled();
  });

  it('does NOT trigger radius deselect on right-click drag when selectionTool is click', () => {
    const preventDefaultMock = vi.fn();
    const contextWithClick = {
      ...defaultContext,
      selectionTool: 'click' as const,
      selectedEdgeIds: ['node-1->node-2'],
    };

    render(
      <MapContext.Provider value={contextWithClick}>
        <MapView />
      </MapContext.Provider>,
    );

    const mouseDownHandler = (mockMap.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'mousedown',
    )?.[1];

    expect(mouseDownHandler).toBeDefined();

    mouseDownHandler({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.1375, lng: 11.575 },
      originalEvent: { button: 2, preventDefault: preventDefaultMock },
    });

    expect(setSelectedEdgeIdsMock).not.toHaveBeenCalled();
  });
});
