import { render } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OSMNetworkQueue } from '../../core/api/OSMNetworkQueue';
import type { StreetGraph } from '../../core/graph/types';
import * as chunkCacheModule from '../../core/storage/chunkCache';
import { chunkRegistry } from '../../core/storage/chunkRegistry';
import { DebugChunksLayer } from './DebugChunksLayer';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';

describe('DebugChunksLayer', () => {
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
        if (id === 'debug-chunks') return mockSource as unknown as maplibregl.GeoJSONSource;
        return undefined;
      }),
      getLayer: vi.fn(() => undefined),
      addSource: addSourceMock,
      addLayer: addLayerMock,
      removeLayer: removeLayerMock,
      removeSource: removeSourceMock,
    } as unknown as Partial<maplibregl.Map>;

    const nodes = new Map();
    // 48.137 is in chunk 3209 (48.137 / 0.015 = 3209), 11.575 is in chunk 578 (11.575 / 0.02 = 578)
    nodes.set('node-1', {
      node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: {} },
      edges: [],
    });
    mockGraph = { nodes };

    vi.spyOn(chunkCacheModule, 'getInMemoryChunkIds').mockReturnValue([]);
    vi.spyOn(chunkCacheModule, 'getInMemoryChunkGraph').mockReturnValue(undefined);
    vi.spyOn(OSMNetworkQueue, 'getPendingChunkIds').mockReturnValue([]);
    vi.spyOn(OSMNetworkQueue, 'getFetchingChunkIds').mockReturnValue([]);
    chunkRegistry.reset();
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
      appMode: 'debug',
      debugSubMode: 'chunks',
      loadedChunkIds: ['3209,578'],
      selectedDebugChunkId: null,
      setAppMode: vi.fn(),
      ...contextOverrides,
    };

    return render(
      <MapContext.Provider value={defaultContext}>
        <DebugChunksLayer />
      </MapContext.Provider>,
    );
  };

  it('registers source and fill, line, and label layers on mount', () => {
    (mockMap.getSource as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

    renderWithContext();

    expect(addSourceMock).toHaveBeenCalledWith(
      'debug-chunks',
      expect.objectContaining({
        type: 'geojson',
      }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'debug-chunks-fill-layer',
        type: 'fill',
        source: 'debug-chunks',
      }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'debug-chunks-line-layer',
        type: 'line',
        source: 'debug-chunks',
      }),
    );
    expect(addLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'debug-chunks-label-layer',
        type: 'symbol',
        source: 'debug-chunks',
      }),
    );
  });

  it('generates chunk boundary features when in debug mode with chunks sub-mode', () => {
    renderWithContext({
      appMode: 'debug',
      debugSubMode: 'chunks',
      loadedChunkIds: ['4813,1157'],
      selectedDebugChunkId: '4813,1157',
    });

    expect(mockSource.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            type: 'Feature',
            properties: expect.objectContaining({
              chunkId: '4813,1157',
              selected: true,
              state: 'loaded',
              nodeCount: 1,
              label: '4813,1157\nLOADED · 1 nodes',
            }),
            geometry: expect.objectContaining({
              type: 'Polygon',
            }),
          }),
        ]),
      }),
    );
  });

  it('renders features for chunks registered in chunkRegistry across various lifecycle states', () => {
    chunkRegistry.setChunkState('1000,1000', 'cached', { nodeCount: 5 });
    chunkRegistry.setChunkState('1000,1001', 'uncached', { nodeCount: 0 });
    chunkRegistry.setChunkState('1000,1002', 'fetching', { nodeCount: 12 });
    chunkRegistry.setChunkState('1000,1003', 'pending', { nodeCount: 3 });
    chunkRegistry.setChunkState('1000,1004', 'loaded', { nodeCount: 20 });
    chunkRegistry.setChunkState('1000,1005', 'error', { nodeCount: 0 });

    renderWithContext({
      appMode: 'debug',
      debugSubMode: 'chunks',
      loadedChunkIds: [],
    });

    const callArgs = mockSource.setData.mock.calls[0];
    const sourceData = callArgs?.[0] as GeoJSON.FeatureCollection;
    expect(sourceData.features).toHaveLength(6);

    const featureMap = new Map(
      sourceData.features.map((f) => [f.properties?.chunkId, f.properties]),
    );

    expect(featureMap.get('1000,1000')).toEqual(
      expect.objectContaining({
        chunkId: '1000,1000',
        state: 'cached',
        nodeCount: 5,
        label: '1000,1000\nCACHED · 5 nodes',
      }),
    );
    expect(featureMap.get('1000,1001')).toEqual(
      expect.objectContaining({
        chunkId: '1000,1001',
        state: 'uncached',
        nodeCount: 0,
        label: '1000,1001\nUNCACHED · 0 nodes',
      }),
    );
    expect(featureMap.get('1000,1002')).toEqual(
      expect.objectContaining({
        chunkId: '1000,1002',
        state: 'fetching',
        nodeCount: 12,
        label: '1000,1002\nFETCHING · 12 nodes',
      }),
    );
    expect(featureMap.get('1000,1003')).toEqual(
      expect.objectContaining({
        chunkId: '1000,1003',
        state: 'pending',
        nodeCount: 3,
        label: '1000,1003\nPENDING · 3 nodes',
      }),
    );
    expect(featureMap.get('1000,1004')).toEqual(
      expect.objectContaining({
        chunkId: '1000,1004',
        state: 'loaded',
        nodeCount: 20,
        label: '1000,1004\nLOADED · 20 nodes',
      }),
    );
    expect(featureMap.get('1000,1005')).toEqual(
      expect.objectContaining({
        chunkId: '1000,1005',
        state: 'error',
        nodeCount: 0,
        label: '1000,1005\nERROR · 0 nodes',
      }),
    );
  });

  it('produces an empty feature collection when appMode is routing', () => {
    renderWithContext({
      appMode: 'routing',
      debugSubMode: 'chunks',
      loadedChunkIds: ['3209,578'],
    });

    expect(mockSource.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('produces an empty feature collection when debugSubMode is route', () => {
    renderWithContext({
      appMode: 'debug',
      debugSubMode: 'route',
      loadedChunkIds: ['3209,578'],
    });

    expect(mockSource.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('aggregates chunks from loadedChunkIds, inMemoryChunkCache, and pending queue without duplicates', () => {
    vi.spyOn(chunkCacheModule, 'getInMemoryChunkIds').mockReturnValue(['3209,578', '3209,579']);
    vi.spyOn(OSMNetworkQueue, 'getPendingChunkIds').mockReturnValue(['3209,579', '3209,580']);

    renderWithContext({
      appMode: 'debug',
      debugSubMode: 'chunks',
      loadedChunkIds: ['3209,578'],
    });

    const callArgs = mockSource.setData.mock.calls[0];
    const sourceData = callArgs?.[0] as GeoJSON.FeatureCollection;
    expect(sourceData.features).toHaveLength(3);
    const chunkIds = sourceData.features.map((f) => f.properties?.chunkId);
    expect(chunkIds).toContain('3209,578');
    expect(chunkIds).toContain('3209,579');
    expect(chunkIds).toContain('3209,580');
  });
});
