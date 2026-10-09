import { render } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MapEvent } from '../../core/events/types';
import type { StreetGraph } from '../../core/graph/types';
import { BlockedEdgesLayer } from './BlockedEdgesLayer';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';

describe('BlockedEdgesLayer', () => {
  let mockMap: Partial<maplibregl.Map>;
  let mockSource: { setData: ReturnType<typeof vi.fn> };
  let mockGraph: StreetGraph;
  let addSourceMock: ReturnType<typeof vi.fn>;
  let addLayerMock: ReturnType<typeof vi.fn>;
  let removeLayerMock: ReturnType<typeof vi.fn>;
  let removeSourceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSource = {
      setData: vi.fn(),
    };

    addSourceMock = vi.fn();
    addLayerMock = vi.fn();
    removeLayerMock = vi.fn();
    removeSourceMock = vi.fn();

    mockMap = {
      getSource: vi.fn((id: string) => {
        if (id === 'blocked-edges') return mockSource as unknown as maplibregl.GeoJSONSource;
        return undefined;
      }),
      getLayer: vi.fn(() => undefined),
      addSource: addSourceMock,
      addLayer: addLayerMock,
      removeLayer: removeLayerMock,
      removeSource: removeSourceMock,
    } as unknown as Partial<maplibregl.Map>;

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
  });

  const renderWithContext = (contextOverrides: Partial<MapContextType> = {}) => {
    const defaultContext: MapContextType = {
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
      ...contextOverrides,
    };

    return render(
      <MapContext.Provider value={defaultContext}>
        <BlockedEdgesLayer />
      </MapContext.Provider>,
    );
  };

  it('registers source and dashed warning layer on mount', () => {
    (mockMap.getSource as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

    renderWithContext();

    expect(addSourceMock).toHaveBeenCalledWith('blocked-edges', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'blocked-edges-layer',
        type: 'line',
        source: 'blocked-edges',
        paint: expect.objectContaining({
          'line-color': '#f43f5e',
          'line-width': 4,
          'line-dasharray': [2, 2],
        }),
      }),
    );
  });

  it('renders features for active road_blockage events and ignores inactive events', () => {
    const activeEvent: MapEvent = {
      id: 'event-1',
      name: 'Roadworks',
      active: true,
      edgeIds: ['node-1->node-2'],
      effect: { type: 'road_blockage', penaltySeconds: 30 },
      createdAt: 1000,
    };

    const inactiveEvent: MapEvent = {
      id: 'event-2',
      name: 'Old block',
      active: false,
      edgeIds: ['node-1->node-2'],
      effect: { type: 'road_blockage', penaltySeconds: 30 },
      createdAt: 500,
    };

    renderWithContext({ events: [activeEvent, inactiveEvent] });

    expect(mockSource.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [11.575, 48.137],
              [11.576, 48.138],
            ],
          },
          properties: {
            edgeId: 'node-1->node-2',
            sourceId: 'node-1',
            targetId: 'node-2',
            eventId: 'event-1',
          },
        },
      ],
    });
  });

  it('cleans up layer and source on unmount', () => {
    (mockMap.getLayer as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'blocked-edges-layer' });
    (mockMap.getSource as ReturnType<typeof vi.fn>).mockReturnValue(mockSource);

    const { unmount } = renderWithContext();
    unmount();

    expect(removeLayerMock).toHaveBeenCalledWith('blocked-edges-layer');
    expect(removeSourceMock).toHaveBeenCalledWith('blocked-edges');
  });
});
