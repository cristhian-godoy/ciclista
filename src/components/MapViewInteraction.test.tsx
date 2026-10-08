import { render } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { Coordinate } from '../core/common/types';
import type { GraphNode } from '../core/graph/types';
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

  it('opens edit modal when right clicking an existing landmark marker feature on the map', () => {
    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      {
        properties: { id: 'lm-market' },
      },
    ]);

    const preventDefaultMock = vi.fn();
    renderMapViewWithContext({ landmarks: [sampleLandmark] });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onContextMenu({
      point: { x: 100, y: 100 },
      lngLat: { lat: 48.1351, lng: 11.5761 },
      originalEvent: { preventDefault: preventDefaultMock },
    });

    expect(preventDefaultMock).toHaveBeenCalled();
    expect(openEditLandmarkModalMock).toHaveBeenCalledWith(sampleLandmark);
    expect(setContextMenuMock).not.toHaveBeenCalled();
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

  it('selects traffic light node, expands cluster, and prevents marker placement when clicking on crossing cluster', () => {
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

    renderMapViewWithContext({ appMode: 'routing' });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 200, y: 300 },
      lngLat: { lat: 48.14, lng: 11.58 },
    });

    expect(setManagedClusterIdMock).toHaveBeenCalledWith('crossing-node-1');
    expect(setManagedNodeIdsMock).toHaveBeenCalledWith(['node-1', 'node-2']);
    expect(onNodeSelectMock).toHaveBeenCalledWith({
      id: 'node-1',
      lat: 48.14,
      lng: 11.58,
      tags: { highway: 'traffic_signals' },
    });
    expect(onStartDragMock).not.toHaveBeenCalled();
    expect(onEndDragMock).not.toHaveBeenCalled();
    expect(mockMapInstance.easeTo).toHaveBeenCalledWith({
      center: [11.58, 48.14],
      zoom: 17.5,
    });
  });

  it('clears node selection and managed clusters when clicking empty map space', () => {
    (mockMapInstance.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValue([]);

    renderMapViewWithContext({ appMode: 'routing' });

    expect(capturedOptions).not.toBeNull();

    capturedOptions!.onClick({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.15, lng: 11.59 },
    });

    expect(setManagedClusterIdMock).toHaveBeenCalledWith(null);
    expect(setManagedNodeIdsMock).toHaveBeenCalledWith([]);
    expect(onNodeSelectMock).toHaveBeenCalledWith(null);
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
});
