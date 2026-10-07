import { render } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { Coordinate } from '../core/common/types';
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
  let setContextMenuMock: ReturnType<typeof vi.fn>;

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
    setContextMenuMock = vi.fn();

    mockMapInstance = {
      on: vi.fn(),
      off: vi.fn(),
      getSource: vi.fn(() => undefined),
      addSource: vi.fn(),
      getLayer: vi.fn((id: string) =>
        id === 'landmarks-circle-layer'
          ? ({
              id: 'landmarks-circle-layer',
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
      dockExpanded: false,
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
});
