import { render } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StreetGraph } from '../../../core/graph/types';
import { MAP_THEME_TOKENS } from '../../../core/rendering/theme';
import { MapContext, type MapContextType } from '../MapContext';
import { CrossingEditorLayer } from './CrossingEditorLayer';

describe('CrossingEditorLayer', () => {
  let mockMap: Partial<maplibregl.Map>;
  let mockSources: Map<string, { setData: ReturnType<typeof vi.fn> }>;
  let mockLayers: Set<string>;
  let addSourceMock: ReturnType<typeof vi.fn>;
  let addLayerMock: ReturnType<typeof vi.fn>;
  let onMock: ReturnType<typeof vi.fn>;
  let offMock: ReturnType<typeof vi.fn>;

  const mockGraph: StreetGraph = {
    nodes: new Map([
      [
        'node-1',
        {
          node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: { highway: 'traffic_signals' } },
          edges: [
            {
              target: 'node-2',
              distance: 15,
              name: 'Bike Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
            {
              target: 'node-5',
              distance: 10,
              name: 'Side Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
          ],
        },
      ],
      [
        'node-2',
        {
          node: { id: 'node-2', lat: 48.1371, lng: 11.5751, tags: { highway: 'traffic_signals' } },
          edges: [
            {
              target: 'node-1',
              distance: 15,
              name: 'Bike Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
            {
              target: 'node-3',
              distance: 15,
              name: 'Bike Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
          ],
        },
      ],
      [
        'node-3',
        {
          node: { id: 'node-3', lat: 48.1372, lng: 11.5752, tags: { highway: 'traffic_signals' } },
          edges: [
            {
              target: 'node-2',
              distance: 15,
              name: 'Bike Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
            {
              target: 'node-4',
              distance: 15,
              name: 'Bike Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
          ],
        },
      ],
      [
        'node-4',
        {
          node: { id: 'node-4', lat: 48.1373, lng: 11.5753, tags: { highway: 'traffic_signals' } },
          edges: [
            {
              target: 'node-3',
              distance: 15,
              name: 'Bike Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
          ],
        },
      ],
      [
        'node-5',
        {
          node: { id: 'node-5', lat: 48.13705, lng: 11.5749, tags: { highway: 'traffic_signals' } },
          edges: [
            {
              target: 'node-1',
              distance: 10,
              name: 'Side Path',
              speedLimit: 20,
              tags: { highway: 'cycleway' },
            },
          ],
        },
      ],
    ]),
  };

  beforeEach(() => {
    mockSources = new Map();
    mockLayers = new Set();
    addSourceMock = vi.fn((id: string) => {
      const src = { setData: vi.fn() };
      mockSources.set(id, src);
    });
    addLayerMock = vi.fn((layer: { id: string }) => {
      mockLayers.add(layer.id);
    });
    onMock = vi.fn();
    offMock = vi.fn();

    const mockCanvas = { style: { cursor: '' } } as HTMLCanvasElement;
    mockMap = {
      getSource: vi.fn((id: string) => mockSources.get(id) as unknown as maplibregl.GeoJSONSource),
      getLayer: vi.fn((id: string) =>
        mockLayers.has(id) ? ({} as maplibregl.LayerSpecification) : undefined,
      ),
      addSource: addSourceMock,
      addLayer: addLayerMock,
      removeLayer: vi.fn((id: string) => mockLayers.delete(id)),
      removeSource: vi.fn((id: string) => mockSources.delete(id)),
      on: onMock,
      off: offMock,
      getCanvas: vi.fn(() => mockCanvas),
    } as unknown as Partial<maplibregl.Map>;
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
      ...contextOverrides,
    };

    return render(
      <MapContext.Provider value={defaultContext}>
        <CrossingEditorLayer />
      </MapContext.Provider>,
    );
  };

  it('registers active crossing MapLibre sources and layers without duplicate clusters', () => {
    renderWithContext();

    // Zero duplicate cluster source or layer
    expect(addSourceMock).not.toHaveBeenCalledWith(
      'crossing-editor-clusters-source',
      expect.any(Object),
    );
    expect(addLayerMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-clusters-circle' }),
    );

    // Active crossing sources registered
    expect(addSourceMock).toHaveBeenCalledWith('crossing-editor-circle-source', expect.any(Object));
    expect(addSourceMock).toHaveBeenCalledWith('crossing-editor-edges-source', expect.any(Object));
    expect(addSourceMock).toHaveBeenCalledWith(
      'crossing-editor-turn-path-source',
      expect.any(Object),
    );
    expect(addSourceMock).toHaveBeenCalledWith('crossing-editor-nodes-source', expect.any(Object));

    // Interactive layers registered
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-circle-fill' }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-edges-line' }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-edges-layer' }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-turn-path-casing' }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-turn-path-line' }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-nodes-circle' }),
    );
  });

  it('keeps active sources empty when no crossing is selected', () => {
    renderWithContext({ activeCrossingId: null });

    const circleSource = mockSources.get('crossing-editor-circle-source');
    const edgesSource = mockSources.get('crossing-editor-edges-source');
    const nodesSource = mockSources.get('crossing-editor-nodes-source');
    const turnPathSource = mockSources.get('crossing-editor-turn-path-source');

    expect(circleSource?.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
    expect(edgesSource?.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
    expect(nodesSource?.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
    expect(turnPathSource?.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('updates bounding circle and subgraph data when active crossing is set', () => {
    renderWithContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: 'node-2', waypointNodeIds: [] },
    });

    const circleSource = mockSources.get('crossing-editor-circle-source');
    expect(circleSource?.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            geometry: expect.objectContaining({ type: 'Polygon' }),
          }),
        ]),
      }),
    );

    const edgesSource = mockSources.get('crossing-editor-edges-source');
    expect(edgesSource?.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({
              color: '#10b981',
              category: 'cycleway',
            }),
          }),
        ]),
      }),
    );
  });

  it('does NOT auto-populate end node when start node is clicked', () => {
    const setActiveTurnSelectionMock = vi.fn();
    renderWithContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: null, toNodeId: null, waypointNodeIds: [] },
      setActiveTurnSelection: setActiveTurnSelectionMock,
    });

    const nodeClickHandler = onMock.mock.calls.find(
      (c) => c[0] === 'click' && c[1] === 'crossing-editor-nodes-circle',
    )?.[2];
    expect(nodeClickHandler).toBeDefined();

    nodeClickHandler({
      features: [{ properties: { nodeId: 'node-1' } }],
    });

    expect(setActiveTurnSelectionMock).toHaveBeenCalled();
    const firstCall1 = setActiveTurnSelectionMock.mock.calls[0];
    expect(firstCall1).toBeDefined();
    if (!firstCall1) return;
    const updateFn = firstCall1[0];
    const updated = updateFn({ fromNodeId: null, toNodeId: null, waypointNodeIds: [] });
    expect(updated.fromNodeId).toBe('node-1');
    expect(updated.toNodeId).toBeNull();
  });

  it('makes crossing edges clickable and does not auto-populate end node on first edge click', () => {
    const setActiveTurnSelectionMock = vi.fn();
    renderWithContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: null, toNodeId: null, waypointNodeIds: [] },
      setActiveTurnSelection: setActiveTurnSelectionMock,
    });

    const edgeClickHandler = onMock.mock.calls.find(
      (c) => c[0] === 'click' && c[1] === 'crossing-edges-layer',
    )?.[2];
    expect(edgeClickHandler).toBeDefined();

    edgeClickHandler({
      features: [{ properties: { sourceId: 'node-1', targetId: 'node-2' } }],
    });

    expect(setActiveTurnSelectionMock).toHaveBeenCalled();
    const firstCall2 = setActiveTurnSelectionMock.mock.calls[0];
    expect(firstCall2).toBeDefined();
    if (!firstCall2) return;
    const updateFn = firstCall2[0];
    const updated = updateFn({ fromNodeId: null, toNodeId: null, waypointNodeIds: [] });
    expect(updated.fromNodeId).toBe('node-1');
    expect(updated.toNodeId).toBeNull();
  });

  it('sets end node when second edge is clicked', () => {
    const setActiveTurnSelectionMock = vi.fn();
    renderWithContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: null, waypointNodeIds: [] },
      setActiveTurnSelection: setActiveTurnSelectionMock,
    });

    const edgeClickHandler = onMock.mock.calls.find(
      (c) => c[0] === 'click' && c[1] === 'crossing-edges-layer',
    )?.[2];
    expect(edgeClickHandler).toBeDefined();

    edgeClickHandler({
      features: [{ properties: { sourceId: 'node-1', targetId: 'node-2' } }],
    });

    expect(setActiveTurnSelectionMock).toHaveBeenCalled();
    const firstCall3 = setActiveTurnSelectionMock.mock.calls[0];
    expect(firstCall3).toBeDefined();
    if (!firstCall3) return;
    const updateFn = firstCall3[0];
    const updated = updateFn({ fromNodeId: 'node-1', toNodeId: null, waypointNodeIds: [] });
    expect(updated.toNodeId).toBe('node-2');
  });

  it('sets pointer cursor on crossing edges hover', () => {
    renderWithContext();

    const mouseEnterHandler = onMock.mock.calls.find(
      (c) => c[0] === 'mouseenter' && c[1] === 'crossing-edges-layer',
    )?.[2];
    expect(mouseEnterHandler).toBeDefined();

    const canvas = mockMap.getCanvas!();
    mouseEnterHandler();
    expect(canvas.style.cursor).toBe('pointer');

    const mouseLeaveHandler = onMock.mock.calls.find(
      (c) => c[0] === 'mouseleave' && c[1] === 'crossing-edges-layer',
    )?.[2];
    expect(mouseLeaveHandler).toBeDefined();

    mouseLeaveHandler();
    expect(canvas.style.cursor).toBe('');
  });

  it('clears all sources when mode is not edit', () => {
    renderWithContext({ appMode: 'routing' });

    for (const [, src] of mockSources.entries()) {
      expect(src.setData).toHaveBeenCalledWith({
        type: 'FeatureCollection',
        features: [],
      });
    }
  });

  it('clears all sources when editSubMode is signals', () => {
    renderWithContext({
      appMode: 'edit',
      editSubMode: 'signals',
      activeCrossingId: 'crossing-node-1',
    });

    for (const [, src] of mockSources.entries()) {
      expect(src.setData).toHaveBeenCalledWith({
        type: 'FeatureCollection',
        features: [],
      });
    }
  });

  it('configures nodes layer paint properties with 5-tier status styling', () => {
    renderWithContext();

    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'crossing-editor-nodes-circle',
        paint: expect.objectContaining({
          'circle-radius': [
            'match',
            ['get', 'status'],
            'start',
            8,
            'end',
            8,
            'waypoint',
            7,
            'path',
            6,
            5,
          ],
          'circle-color': [
            'match',
            ['get', 'status'],
            'start',
            MAP_THEME_TOKENS.status.success,
            'end',
            MAP_THEME_TOKENS.status.danger,
            'waypoint',
            MAP_THEME_TOKENS.brand.purple,
            'path',
            MAP_THEME_TOKENS.brand.amber,
            MAP_THEME_TOKENS.overlay.white,
          ],
          'circle-stroke-color': MAP_THEME_TOKENS.overlay.darkNavy,
          'circle-stroke-width': 2,
        }),
      }),
    );
  });

  it('assigns 5-tier status (start, end, waypoint, path, normal) to crossing nodes', () => {
    renderWithContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: {
        fromNodeId: 'node-1',
        toNodeId: 'node-4',
        waypointNodeIds: ['node-3'],
      },
    });

    const nodesSource = mockSources.get('crossing-editor-nodes-source');
    expect(nodesSource?.setData).toHaveBeenCalled();
    const calls = nodesSource?.setData.mock.calls;
    const lastCall = calls?.[calls.length - 1]?.[0] as GeoJSON.FeatureCollection;
    expect(lastCall.type).toBe('FeatureCollection');

    const statusByNodeId = new Map(
      lastCall.features.map((f) => [f.properties?.nodeId, f.properties?.status]),
    );

    expect(statusByNodeId.get('node-1')).toBe('start');
    expect(statusByNodeId.get('node-4')).toBe('end');
    expect(statusByNodeId.get('node-3')).toBe('waypoint');
    expect(statusByNodeId.get('node-2')).toBe('path');
    expect(statusByNodeId.get('node-5')).toBe('normal');
  });

  it('prevents edge click handling when node click sets originalEvent.defaultPrevented', () => {
    const setActiveTurnSelectionMock = vi.fn();
    renderWithContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: null, toNodeId: null, waypointNodeIds: [] },
      setActiveTurnSelection: setActiveTurnSelectionMock,
    });

    const nodeClickHandler = onMock.mock.calls.find(
      (c) => c[0] === 'click' && c[1] === 'crossing-editor-nodes-circle',
    )?.[2];
    const edgeClickHandler = onMock.mock.calls.find(
      (c) => c[0] === 'click' && c[1] === 'crossing-edges-layer',
    )?.[2];

    expect(nodeClickHandler).toBeDefined();
    expect(edgeClickHandler).toBeDefined();

    const sharedEvent: {
      defaultPrevented: boolean;
      originalEvent: { defaultPrevented: boolean };
      preventDefault: ReturnType<typeof vi.fn>;
      features: Array<{ properties: Record<string, string> }>;
    } = {
      defaultPrevented: false,
      originalEvent: { defaultPrevented: false },
      preventDefault: vi.fn(),
      features: [{ properties: { nodeId: 'node-1' } }],
    };

    // Node click fires first
    nodeClickHandler(sharedEvent);
    expect(sharedEvent.originalEvent.defaultPrevented).toBe(true);
    expect(setActiveTurnSelectionMock).toHaveBeenCalledTimes(1);

    // Edge click fires subsequently with the same event
    sharedEvent.features = [{ properties: { sourceId: 'node-1', targetId: 'node-2' } }];
    edgeClickHandler(sharedEvent);

    // Should NOT have called setActiveTurnSelection again
    expect(setActiveTurnSelectionMock).toHaveBeenCalledTimes(1);
  });

  it('toggles waypoint node when start and end are already selected', () => {
    const setActiveTurnSelectionMock = vi.fn();
    renderWithContext({
      activeCrossingId: 'crossing-node-1',
      activeTurnSelection: { fromNodeId: 'node-1', toNodeId: 'node-4', waypointNodeIds: [] },
      setActiveTurnSelection: setActiveTurnSelectionMock,
    });

    const nodeClickHandler = onMock.mock.calls.find(
      (c) => c[0] === 'click' && c[1] === 'crossing-editor-nodes-circle',
    )?.[2];
    expect(nodeClickHandler).toBeDefined();

    nodeClickHandler({
      preventDefault: vi.fn(),
      originalEvent: { defaultPrevented: false },
      features: [{ properties: { nodeId: 'node-3' } }],
    });

    expect(setActiveTurnSelectionMock).toHaveBeenCalled();
    const updateFn = setActiveTurnSelectionMock.mock.calls[0]?.[0];
    expect(updateFn).toBeDefined();
    if (!updateFn) return;
    const updated = updateFn({ fromNodeId: 'node-1', toNodeId: 'node-4', waypointNodeIds: [] });
    expect(updated.waypointNodeIds).toEqual(['node-3']);

    // Toggling again removes the waypoint
    const toggledOff = updateFn({
      fromNodeId: 'node-1',
      toNodeId: 'node-4',
      waypointNodeIds: ['node-3'],
    });
    expect(toggledOff.waypointNodeIds).toEqual([]);
  });
});
