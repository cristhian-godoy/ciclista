import { render } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Landmark } from '../../core/landmarks/types';
import { LandmarksLayer } from './LandmarksLayer';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';

describe('LandmarksLayer', () => {
  let mockMap: Partial<maplibregl.Map>;
  let mockSource: { setData: ReturnType<typeof vi.fn> };
  let addSourceMock: ReturnType<typeof vi.fn>;
  let addLayerMock: ReturnType<typeof vi.fn>;
  let removeLayerMock: ReturnType<typeof vi.fn>;
  let removeSourceMock: ReturnType<typeof vi.fn>;
  let onMock: ReturnType<typeof vi.fn>;
  let offMock: ReturnType<typeof vi.fn>;

  const sampleLandmarks: Landmark[] = [
    {
      id: 'lm-1',
      name: 'Home',
      category: 'home',
      lat: 48.137,
      lng: 11.575,
      description: 'Apartment',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'lm-2',
      name: 'Office',
      category: 'work',
      lat: 48.145,
      lng: 11.585,
      createdAt: 2000,
      updatedAt: 2000,
    },
  ];

  beforeEach(() => {
    mockSource = {
      setData: vi.fn(),
    };

    addSourceMock = vi.fn();
    addLayerMock = vi.fn();
    removeLayerMock = vi.fn();
    removeSourceMock = vi.fn();
    onMock = vi.fn();
    offMock = vi.fn();

    mockMap = {
      getSource: vi.fn((id: string) => {
        if (id === 'landmarks-source') return mockSource as unknown as maplibregl.GeoJSONSource;
        return undefined;
      }),
      getLayer: vi.fn(() => undefined),
      addSource: addSourceMock,
      addLayer: addLayerMock,
      removeLayer: removeLayerMock,
      removeSource: removeSourceMock,
      on: onMock,
      off: offMock,
    } as unknown as Partial<maplibregl.Map>;
  });

  const renderWithContext = (contextOverrides: Partial<MapContextType> = {}) => {
    const defaultContext: MapContextType = {
      map: mockMap as maplibregl.Map,
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
      appMode: 'landmarks',
      setAppMode: vi.fn(),
      landmarks: sampleLandmarks,
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
      openCreateLandmarkModal: vi.fn(),
      openEditLandmarkModal: vi.fn(),
      closeLandmarkModal: vi.fn(),
      onCreateLandmark: vi.fn(),
      onUpdateLandmark: vi.fn(),
      onDeleteLandmark: vi.fn(),
      ...contextOverrides,
    };

    return render(
      <MapContext.Provider value={defaultContext}>
        <LandmarksLayer />
      </MapContext.Provider>,
    );
  };

  it('adds GeoJSON source and layers on map when mounted', () => {
    (mockMap.getSource as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

    renderWithContext();

    expect(addSourceMock).toHaveBeenCalledWith(
      'landmarks-source',
      expect.objectContaining({
        type: 'geojson',
      }),
    );

    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'landmarks-glow-layer',
        type: 'circle',
      }),
    );

    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'landmarks-circle-layer',
        type: 'circle',
      }),
    );

    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'landmarks-label-layer',
        type: 'symbol',
      }),
    );
  });

  it('synchronizes landmarks data to the GeoJSON source', () => {
    renderWithContext({ landmarks: sampleLandmarks });

    expect(mockSource.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [11.575, 48.137],
            },
            properties: expect.objectContaining({
              name: 'Home',
              category: 'home',
            }),
          }),
          expect.objectContaining({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [11.585, 48.145],
            },
            properties: expect.objectContaining({
              name: 'Office',
              category: 'work',
            }),
          }),
        ]),
      }),
    );
  });

  it('registers click and contextmenu listeners on landmark layers and cleans up on unmount', () => {
    const { unmount } = renderWithContext();

    expect(onMock).toHaveBeenCalledWith('click', 'landmarks-circle-layer', expect.any(Function));
    expect(onMock).toHaveBeenCalledWith(
      'contextmenu',
      'landmarks-circle-layer',
      expect.any(Function),
    );
    expect(onMock).toHaveBeenCalledWith(
      'contextmenu',
      'landmarks-label-layer',
      expect.any(Function),
    );

    unmount();

    expect(offMock).toHaveBeenCalledWith('click', 'landmarks-circle-layer', expect.any(Function));
    expect(offMock).toHaveBeenCalledWith(
      'contextmenu',
      'landmarks-circle-layer',
      expect.any(Function),
    );
    expect(offMock).toHaveBeenCalledWith(
      'contextmenu',
      'landmarks-label-layer',
      expect.any(Function),
    );
  });

  it('opens edit modal when clicking existing landmark in landmarks mode', () => {
    const openEditLandmarkModalMock = vi.fn();
    const onStartDragMock = vi.fn();

    renderWithContext({
      appMode: 'landmarks',
      openEditLandmarkModal: openEditLandmarkModalMock,
      onStartDrag: onStartDragMock,
    });

    const clickHandler = onMock.mock.calls.find(
      (call) => call[0] === 'click' && call[1] === 'landmarks-circle-layer',
    )?.[2];

    expect(clickHandler).toBeDefined();

    clickHandler({
      features: [
        {
          properties: { id: 'lm-1', lat: 48.137, lng: 11.575 },
        },
      ],
      originalEvent: { shiftKey: false },
    });

    expect(openEditLandmarkModalMock).toHaveBeenCalledWith(sampleLandmarks[0]);
    expect(onStartDragMock).not.toHaveBeenCalled();
  });

  it('sets routing start pin when clicking existing landmark in routing mode', () => {
    const openEditLandmarkModalMock = vi.fn();
    const onStartDragMock = vi.fn();

    renderWithContext({
      appMode: 'routing',
      openEditLandmarkModal: openEditLandmarkModalMock,
      onStartDrag: onStartDragMock,
    });

    const clickHandler = onMock.mock.calls.find(
      (call) => call[0] === 'click' && call[1] === 'landmarks-circle-layer',
    )?.[2];

    expect(clickHandler).toBeDefined();

    clickHandler({
      features: [
        {
          properties: { id: 'lm-1', lat: 48.137, lng: 11.575 },
        },
      ],
      originalEvent: { shiftKey: false },
    });

    expect(openEditLandmarkModalMock).not.toHaveBeenCalled();
    expect(onStartDragMock).toHaveBeenCalledWith({ lat: 48.137, lng: 11.575 });
  });

  it('opens edit modal when right clicking an existing landmark marker', () => {
    const openEditLandmarkModalMock = vi.fn();
    const preventDefaultMock = vi.fn();

    renderWithContext({
      appMode: 'routing',
      openEditLandmarkModal: openEditLandmarkModalMock,
    });

    const contextMenuHandler = onMock.mock.calls.find(
      (call) => call[0] === 'contextmenu' && call[1] === 'landmarks-circle-layer',
    )?.[2];

    expect(contextMenuHandler).toBeDefined();

    contextMenuHandler({
      features: [
        {
          properties: { id: 'lm-2', lat: 48.145, lng: 11.585 },
        },
      ],
      originalEvent: { preventDefault: preventDefaultMock },
    });

    expect(preventDefaultMock).toHaveBeenCalled();
    expect(openEditLandmarkModalMock).toHaveBeenCalledWith(sampleLandmarks[1]);
  });
});
