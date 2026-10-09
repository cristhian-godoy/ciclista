import { render } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StreetGraph } from '../../../core/graph/types';
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
      getCanvas: vi.fn(() => ({ style: {} }) as HTMLCanvasElement),
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

  it('registers all required MapLibre sources and layers on mount', () => {
    renderWithContext();

    expect(addSourceMock).toHaveBeenCalledWith(
      'crossing-editor-clusters-source',
      expect.any(Object),
    );
    expect(addSourceMock).toHaveBeenCalledWith('crossing-editor-circle-source', expect.any(Object));
    expect(addSourceMock).toHaveBeenCalledWith('crossing-editor-edges-source', expect.any(Object));
    expect(addSourceMock).toHaveBeenCalledWith(
      'crossing-editor-turn-path-source',
      expect.any(Object),
    );
    expect(addSourceMock).toHaveBeenCalledWith('crossing-editor-nodes-source', expect.any(Object));

    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-clusters-circle' }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-circle-fill' }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-edges-line' }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-turn-path-line' }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crossing-editor-nodes-circle' }),
    );
  });

  it('populates cluster features when in edit mode', () => {
    renderWithContext();

    const clusterSource = mockSources.get('crossing-editor-clusters-source');
    expect(clusterSource?.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ crossingId: 'crossing-node-1' }),
          }),
        ]),
      }),
    );
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

  it('clears all sources when mode is not edit', () => {
    renderWithContext({ appMode: 'routing' });

    for (const [, src] of mockSources.entries()) {
      expect(src.setData).toHaveBeenCalledWith({
        type: 'FeatureCollection',
        features: [],
      });
    }
  });
});
