import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { Coordinate } from '../core/common/types';
import type { GraphNode, StreetGraph } from '../core/graph/types';
import type { Landmark } from '../core/landmarks/types';
import type { MapContextType } from './map/MapContext';
import { MapContext } from './map/MapContext';
import { MapView } from './MapView';

interface MockMapInstanceOptions {
  onClick: (e: {
    point: { x: number; y: number };
    lngLat: { lat: number; lng: number };
    defaultPrevented?: boolean;
  }) => void;
  onContextMenu: (e: {
    point: { x: number; y: number };
    lngLat: { lat: number; lng: number };
    originalEvent?: { preventDefault: () => void };
  }) => void;
}

let capturedOptions: MockMapInstanceOptions | null = null;
let mockMapInstance: Partial<maplibregl.Map>;

vi.mock('./map/useMapInstance', () => ({
  useMapInstance: (options: MockMapInstanceOptions) => {
    capturedOptions = options;
    return {
      map: mockMapInstance,
      mapContainerRef: { current: null },
      mapReady: true,
    };
  },
}));

describe('MapView Contextual Map Interactions', () => {
  let onStartDragMock: Mock<(coord: Coordinate | null) => void>;
  let onEndDragMock: Mock<(coord: Coordinate | null) => void>;
  let openCreateLandmarkModalMock: Mock<(coord?: Coordinate | null) => void>;
  let openEditLandmarkModalMock: Mock<(landmark: Landmark) => void>;
  let onNodeSelectMock: Mock<(node: GraphNode | null) => void>;
  let setManagedClusterIdMock: Mock<(id: string | null) => void>;
  let setManagedNodeIdsMock: Mock<React.Dispatch<React.SetStateAction<string[]>>>;
  let setContextMenuMock: ReturnType<typeof vi.fn>;
  let setIsPlacingPlaceMock: Mock<(val: boolean) => void>;

  const sampleLandmark: Landmark = {
    id: 'lm-market',
    name: 'Viktualienmarkt',
    category: 'shop',
    lat: 48.1351,
    lng: 11.5761,
    createdAt: 1000,
    updatedAt: 1000,
  };

  beforeEach(() => {
    capturedOptions = null;
    onStartDragMock = vi.fn();
    onEndDragMock = vi.fn();
    openCreateLandmarkModalMock = vi.fn();
    openEditLandmarkModalMock = vi.fn();
    onNodeSelectMock = vi.fn();
    setManagedClusterIdMock = vi.fn();
    setManagedNodeIdsMock = vi.fn();
    setContextMenuMock = vi.fn();
    setIsPlacingPlaceMock = vi.fn();

    mockMapInstance = {
      on: vi.fn(),
      off: vi.fn(),
      easeTo: vi.fn(),
      project: vi.fn((coords: [number, number]) => ({
        x: coords[0] * 10,
        y: coords[1] * 10,
      })) as unknown as maplibregl.Map['project'],
      getSource: vi.fn(() => undefined),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) =>
        id === 'landmarks-circle-layer' ||
        id === 'traffic-lights-unclustered' ||
        id === 'traffic-lights-cluster'
          ? ({
              id,
              type: 'circle',
            } as unknown as maplibregl.StyleLayer)
          : undefined,
      ) as unknown as maplibregl.Map['getLayer'],
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
  });

  const renderMapViewWithContext = (contextOverrides: Partial<MapContextType> = {}) => {
    const contextValue: MapContextType = {
      map: mockMapInstance as maplibregl.Map,
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
      selectedPreset: 'munich',
      customNodeDelays: new Map(),
      customNodeNotes: new Map(),
      customNodeTurns: new Map(),
      selectedNode: null,
      onStartDrag: onStartDragMock,
      onEndDrag: onEndDragMock,
      onNodeSelect: onNodeSelectMock,
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
      dockExpanded: false,
      setDockExpanded: vi.fn(),
      managedClusterId: null,
      setManagedClusterId: setManagedClusterIdMock,
      managedNodeIds: [],
      setManagedNodeIds: setManagedNodeIdsMock,
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
      appMode: 'routing',
      setAppMode: vi.fn(),
      landmarks: [sampleLandmark],
      setLandmarks: vi.fn(),
      selectedEdgeIds: [],
      setSelectedEdgeIds: vi.fn(),
      selectionTool: 'click',
      setSelectionTool: vi.fn(),
      brushRadius: 20,
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
      openCreateLandmarkModal: openCreateLandmarkModalMock,
      openEditLandmarkModal: openEditLandmarkModalMock,
      closeLandmarkModal: vi.fn(),
      onCreateLandmark: vi.fn(),
      onUpdateLandmark: vi.fn(),
      onDeleteLandmark: vi.fn(),
      isPlacingPlace: false,
      setIsPlacingPlace: setIsPlacingPlaceMock,
      ...contextOverrides,
    };

    return render(
      <MapContext.Provider value={contextValue}>
        <MapView />
      </MapContext.Provider>,
    );
  };

  it('opens landmark creation modal on left click when in landmarks mode and does not place route pins', () => {
    renderMapViewWithContext({ appMode: 'landmarks' });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 150, y: 250 },
      lngLat: { lat: 48.137, lng: 11.575 },
    });

    expect(openCreateLandmarkModalMock).toHaveBeenCalledWith({
      lat: 48.137,
      lng: 11.575,
    });
    expect(onStartDragMock).not.toHaveBeenCalled();
    expect(onEndDragMock).not.toHaveBeenCalled();
  });

  it('places start route pin on left click when in routing mode', () => {
    renderMapViewWithContext({ appMode: 'routing', startCoord: null, endCoord: null });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 150, y: 250 },
      lngLat: { lat: 48.137, lng: 11.575 },
    });

    expect(openCreateLandmarkModalMock).not.toHaveBeenCalled();
    expect(onStartDragMock).toHaveBeenCalledWith({
      lat: 48.137,
      lng: 11.575,
    });
  });

  it('places end route pin on left click when start pin already exists in routing mode', () => {
    renderMapViewWithContext({
      appMode: 'routing',
      startCoord: { lat: 48.13, lng: 11.56 },
      endCoord: null,
    });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 200, y: 300 },
      lngLat: { lat: 48.14, lng: 11.58 },
    });

    expect(openCreateLandmarkModalMock).not.toHaveBeenCalled();
    expect(onEndDragMock).toHaveBeenCalledWith({
      lat: 48.14,
      lng: 11.58,
    });
  });

  it('opens context menu with placeId and does NOT open edit modal when right clicking an existing landmark marker feature', () => {
    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      {
        properties: { id: 'lm-market' },
      },
    ]);

    renderMapViewWithContext({ landmarks: [sampleLandmark] });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onContextMenu({
      point: { x: 100, y: 100 },
      lngLat: { lat: 48.1351, lng: 11.5761 },
    });

    expect(openEditLandmarkModalMock).not.toHaveBeenCalled();
    expect(setContextMenuMock).toHaveBeenCalledWith({
      visible: true,
      x: 100,
      y: 100,
      lng: 11.5761,
      lat: 48.1351,
      crossingId: null,
      nodeIds: null,
      placeId: 'lm-market',
    });
  });

  it('opens standard context menu when right clicking map with no landmark marker hit', () => {
    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValue([]);

    renderMapViewWithContext();

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onContextMenu({
      point: { x: 80, y: 90 },
      lngLat: { lat: 48.12, lng: 11.55 },
    });

    expect(openEditLandmarkModalMock).not.toHaveBeenCalled();
    expect(setContextMenuMock).toHaveBeenCalledWith({
      visible: true,
      x: 80,
      y: 90,
      lng: 11.55,
      lat: 48.12,
      crossingId: null,
      nodeIds: null,
      placeId: null,
    });
  });

  it('selects traffic light node and prevents marker placement when clicking on unclustered signal', () => {
    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        layer: { id: 'traffic-lights-unclustered' },
        geometry: { coordinates: [11.575, 48.137] },
        properties: {
          id: 'node-signal-1',
          tags: JSON.stringify({ highway: 'traffic_signals', name: 'Sendlinger Tor' }),
        },
      },
    ]);

    renderMapViewWithContext({ appMode: 'routing', startCoord: null, endCoord: null });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 150, y: 250 },
      lngLat: { lat: 48.137, lng: 11.575 },
    });

    expect(onNodeSelectMock).toHaveBeenCalledWith({
      id: 'node-signal-1',
      lat: 48.137,
      lng: 11.575,
      tags: { highway: 'traffic_signals', name: 'Sendlinger Tor' },
    });
    expect(onStartDragMock).not.toHaveBeenCalled();
    expect(onEndDragMock).not.toHaveBeenCalled();
    expect(openCreateLandmarkModalMock).not.toHaveBeenCalled();
    expect(mockMapInstance.easeTo).toHaveBeenCalledWith({
      center: [11.575, 48.137],
      duration: 400,
    });
  });

  it('expands cluster, zooms in, and does NOT select node or open popup when clicking on crossing cluster', () => {
    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        layer: { id: 'traffic-lights-cluster' },
        geometry: { coordinates: [11.58, 48.14] },
        properties: {
          type: 'crossing',
          crossingId: 'crossing-node-1',
          nodeIds: JSON.stringify(['node-1', 'node-2']),
        },
      },
    ]);

    const { container } = renderMapViewWithContext({ appMode: 'routing' });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 200, y: 300 },
      lngLat: { lat: 48.14, lng: 11.58 },
    });

    expect(setManagedClusterIdMock).toHaveBeenCalledWith('crossing-node-1');
    expect(setManagedNodeIdsMock).toHaveBeenCalledWith(['node-1', 'node-2']);
    expect(onNodeSelectMock).not.toHaveBeenCalled();
    expect(container.querySelector('.map-popup')).not.toBeInTheDocument();
    expect(onStartDragMock).not.toHaveBeenCalled();
    expect(onEndDragMock).not.toHaveBeenCalled();
    expect(mockMapInstance.easeTo).toHaveBeenCalledWith({
      center: [11.58, 48.14],
      zoom: 17.5,
    });
  });

  it('clears node selection but keeps expanded cluster when clicking empty map space', () => {
    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValue([]);

    renderMapViewWithContext({
      appMode: 'routing',
      managedClusterId: 'crossing-node-1',
      managedNodeIds: ['node-1', 'node-2'],
    });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.15, lng: 11.59 },
    });

    expect(onNodeSelectMock).toHaveBeenCalledWith(null);
    expect(setManagedClusterIdMock).not.toHaveBeenCalled();
    expect(setManagedNodeIdsMock).not.toHaveBeenCalled();
  });

  it('collapses expanded crossing cluster when zooming out below threshold', () => {
    mockMapInstance.getZoom = vi.fn(() => 15);
    mockMapInstance.getCenter = vi.fn(
      () => ({ lat: 48.14, lng: 11.58 }) as unknown as maplibregl.LngLat,
    );

    renderMapViewWithContext({
      appMode: 'routing',
      managedClusterId: 'crossing-node-1',
      managedNodeIds: ['node-1', 'node-2'],
    });

    const moveendHandler = (mockMapInstance.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'moveend',
    )?.[1];

    expect(moveendHandler).toBeDefined();

    moveendHandler();

    expect(setManagedClusterIdMock).toHaveBeenCalledWith(null);
    expect(setManagedNodeIdsMock).toHaveBeenCalledWith([]);
  });

  it('collapses expanded crossing cluster when panning far away from crossing', () => {
    mockMapInstance.getZoom = vi.fn(() => 17);
    mockMapInstance.getCenter = vi.fn(
      () => ({ lat: 48.2, lng: 11.58 }) as unknown as maplibregl.LngLat,
    );

    const nodes = new Map();
    nodes.set('node-1', {
      node: { id: 'node-1', lat: 48.14, lng: 11.58, tags: {} },
      edges: [],
    });
    const sampleGraph = { nodes } as unknown as StreetGraph;

    renderMapViewWithContext({
      appMode: 'routing',
      graph: sampleGraph,
      managedClusterId: 'crossing-node-1',
      managedNodeIds: ['node-1'],
    });

    const moveendHandler = (mockMapInstance.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'moveend',
    )?.[1];

    expect(moveendHandler).toBeDefined();

    moveendHandler();

    expect(setManagedClusterIdMock).toHaveBeenCalledWith(null);
    expect(setManagedNodeIdsMock).toHaveBeenCalledWith([]);
  });

  it('preserves expanded crossing cluster when rotating or panning nearby', () => {
    mockMapInstance.getZoom = vi.fn(() => 17);
    mockMapInstance.getCenter = vi.fn(
      () => ({ lat: 48.1405, lng: 11.5805 }) as unknown as maplibregl.LngLat,
    );

    const nodes = new Map();
    nodes.set('node-1', {
      node: { id: 'node-1', lat: 48.14, lng: 11.58, tags: {} },
      edges: [],
    });
    const sampleGraph = { nodes } as unknown as StreetGraph;

    renderMapViewWithContext({
      appMode: 'routing',
      graph: sampleGraph,
      managedClusterId: 'crossing-node-1',
      managedNodeIds: ['node-1'],
    });

    const moveendHandler = (mockMapInstance.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'moveend',
    )?.[1];

    expect(moveendHandler).toBeDefined();

    moveendHandler();

    expect(setManagedClusterIdMock).not.toHaveBeenCalled();
    expect(setManagedNodeIdsMock).not.toHaveBeenCalled();
  });

  it('renders TrafficLightPopup / NodePopup when a traffic light node is selected', () => {
    const selectedSignalNode = {
      id: 'node-signal-1',
      lat: 48.137,
      lng: 11.575,
      tags: { highway: 'traffic_signals', name: 'Sendlinger Tor' },
    };

    const { container } = renderMapViewWithContext({
      appMode: 'routing',
      selectedNode: selectedSignalNode,
    });

    const popup = container.querySelector('.map-popup');
    expect(popup).toBeInTheDocument();
    expect(popup).toHaveTextContent('Configure Control Point');
    expect(popup).toHaveTextContent('Traffic Signal');
    expect(popup).toHaveTextContent('node-signal-1');
    expect(popup).toHaveTextContent('Sendlinger Tor');
  });

  it('changes cursor to crosshair and applies map-pin-placement-mode class in pin placement mode', () => {
    const mockCanvas = { style: { cursor: '' } };
    mockMapInstance.getCanvas = vi.fn(() => mockCanvas) as unknown as () => HTMLCanvasElement;

    const { container } = renderMapViewWithContext({ isPlacingPlace: true });

    expect(mockCanvas.style.cursor).toBe('crosshair');
    expect(container.querySelector('.map-wrapper')).toHaveClass('map-pin-placement-mode');
  });

  it('captures clicked coordinates, exits pin placement mode, and opens place modal on map click', () => {
    renderMapViewWithContext({
      isPlacingPlace: true,
      setIsPlacingPlace: setIsPlacingPlaceMock,
    });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 150, y: 220 },
      lngLat: { lat: 48.139, lng: 11.578 },
    });

    expect(setIsPlacingPlaceMock).toHaveBeenCalledWith(false);
    expect(openCreateLandmarkModalMock).toHaveBeenCalledWith({
      lat: 48.139,
      lng: 11.578,
    });
    expect(onStartDragMock).not.toHaveBeenCalled();
    expect(onEndDragMock).not.toHaveBeenCalled();
  });

  it('renders persistent toast when in pin placement mode and dismisses via close button or Escape key', async () => {
    const user = userEvent.setup();

    renderMapViewWithContext({
      isPlacingPlace: true,
      setIsPlacingPlace: setIsPlacingPlaceMock,
    });

    expect(screen.getByText('Click on the map to set place location')).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss notification' });
    await user.click(dismissBtn);

    expect(setIsPlacingPlaceMock).toHaveBeenCalledWith(false);

    setIsPlacingPlaceMock.mockClear();
    await user.keyboard('{Escape}');
    expect(setIsPlacingPlaceMock).toHaveBeenCalledWith(false);
  });

  it('bypasses traffic light node selection when clicking on unclustered signal in placement mode', () => {
    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        layer: { id: 'traffic-lights-unclustered' },
        geometry: { coordinates: [11.575, 48.137] },
        properties: {
          id: 'node-signal-1',
          tags: JSON.stringify({ highway: 'traffic_signals', name: 'Sendlinger Tor' }),
        },
      },
    ]);

    renderMapViewWithContext({
      isPlacingPlace: true,
      setIsPlacingPlace: setIsPlacingPlaceMock,
    });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 150, y: 250 },
      lngLat: { lat: 48.137, lng: 11.575 },
    });

    expect(setIsPlacingPlaceMock).toHaveBeenCalledWith(false);
    expect(openCreateLandmarkModalMock).toHaveBeenCalledWith({
      lat: 48.137,
      lng: 11.575,
    });
    expect(onNodeSelectMock).not.toHaveBeenCalled();
    expect(setManagedClusterIdMock).not.toHaveBeenCalled();
    expect(onStartDragMock).not.toHaveBeenCalled();
    expect(onEndDragMock).not.toHaveBeenCalled();
  });

  it('bypasses crossing cluster expansion when clicking on cluster in placement mode', () => {
    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        layer: { id: 'traffic-lights-cluster' },
        geometry: { coordinates: [11.58, 48.14] },
        properties: {
          type: 'crossing',
          crossingId: 'crossing-node-1',
          nodeIds: JSON.stringify(['node-1', 'node-2']),
        },
      },
    ]);

    renderMapViewWithContext({
      isPlacingPlace: true,
      setIsPlacingPlace: setIsPlacingPlaceMock,
    });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 200, y: 300 },
      lngLat: { lat: 48.14, lng: 11.58 },
    });

    expect(setIsPlacingPlaceMock).toHaveBeenCalledWith(false);
    expect(openCreateLandmarkModalMock).toHaveBeenCalledWith({
      lat: 48.14,
      lng: 11.58,
    });
    expect(setManagedClusterIdMock).not.toHaveBeenCalled();
    expect(onNodeSelectMock).not.toHaveBeenCalled();
    expect(onStartDragMock).not.toHaveBeenCalled();
    expect(onEndDragMock).not.toHaveBeenCalled();
  });

  it('bypasses direct layer clicks on StreetGraphLayer when in pin placement mode', () => {
    renderMapViewWithContext({
      isPlacingPlace: true,
      setIsPlacingPlace: setIsPlacingPlaceMock,
    });

    const unclusteredClickHandler = (
      mockMapInstance.on as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      (call) => call[0] === 'click' && call[1] === 'traffic-lights-unclustered',
    )?.[2];

    const clusterClickHandler = (mockMapInstance.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'click' && call[1] === 'traffic-lights-cluster',
    )?.[2];

    expect(unclusteredClickHandler).toBeDefined();
    expect(clusterClickHandler).toBeDefined();

    const mockPreventDefault = vi.fn();
    unclusteredClickHandler({
      preventDefault: mockPreventDefault,
      features: [
        {
          properties: { id: 'node-1' },
          geometry: { coordinates: [11.575, 48.137] },
        },
      ],
    });

    expect(mockPreventDefault).not.toHaveBeenCalled();
    expect(onNodeSelectMock).not.toHaveBeenCalled();

    clusterClickHandler({
      preventDefault: mockPreventDefault,
      features: [
        {
          properties: { crossingId: 'c-1', nodeIds: '["node-1"]' },
          geometry: { coordinates: [11.575, 48.137] },
        },
      ],
    });

    expect(mockPreventDefault).not.toHaveBeenCalled();
    expect(setManagedClusterIdMock).not.toHaveBeenCalled();
  });

  it('unselects a single edge on right-click contextmenu when in studio mode with click tool', () => {
    const preventDefaultMock = vi.fn();
    const setSelectedEdgeIdsMock = vi.fn();

    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { properties: { edgeId: 'edge-1->edge-2' } },
    ]);

    renderMapViewWithContext({
      appMode: 'studio',
      selectionTool: 'click',
      selectedEdgeIds: ['edge-1->edge-2', 'edge-3->edge-4'],
      setSelectedEdgeIds: setSelectedEdgeIdsMock as unknown as React.Dispatch<
        React.SetStateAction<string[]>
      >,
    });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onContextMenu({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.1375, lng: 11.575 },
      originalEvent: { preventDefault: preventDefaultMock },
    });

    expect(preventDefaultMock).toHaveBeenCalled();
    expect(setSelectedEdgeIdsMock).toHaveBeenCalledTimes(1);
    const updater = setSelectedEdgeIdsMock.mock.calls[0][0];
    if (typeof updater === 'function') {
      const remaining = updater(['edge-1->edge-2', 'edge-3->edge-4']);
      expect(remaining).toEqual(['edge-3->edge-4']);
    }
  });

  it('erases all edges in brush radius on right-click contextmenu when in studio mode with brush tool', () => {
    const preventDefaultMock = vi.fn();
    const setSelectedEdgeIdsMock = vi.fn();

    const nodes = new Map();
    nodes.set('node-1', {
      node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: {} },
      edges: [{ target: 'node-2', distance: 100, tags: {} }],
    });
    nodes.set('node-2', {
      node: { id: 'node-2', lat: 48.138, lng: 11.576, tags: {} },
      edges: [{ target: 'node-1', distance: 100, tags: {} }],
    });
    const mockGraph = { nodes };

    renderMapViewWithContext({
      appMode: 'studio',
      selectionTool: 'brush',
      brushRadius: 100,
      graph: mockGraph,
      selectedEdgeIds: ['node-1->node-2'],
      setSelectedEdgeIds: setSelectedEdgeIdsMock as unknown as React.Dispatch<
        React.SetStateAction<string[]>
      >,
    });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onContextMenu({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.1375, lng: 11.575 },
      originalEvent: { preventDefault: preventDefaultMock },
    });

    expect(preventDefaultMock).toHaveBeenCalled();
    expect(setSelectedEdgeIdsMock).toHaveBeenCalledTimes(1);
  });
});
