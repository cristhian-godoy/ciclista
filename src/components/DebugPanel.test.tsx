import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OSMNetworkQueue } from '../core/api/OSMNetworkQueue';
import type { StreetGraph } from '../core/graph/types';
import type { RouteResult, StrategyRouteVariant } from '../core/router/types';
import * as chunkCache from '../core/storage/chunkCache';
import { DebugPanel } from './DebugPanel';
import { MapContext, type MapContextType } from './map/MapContext';

vi.mock('../core/api/OSMNetworkQueue', () => ({
  OSMNetworkQueue: {
    getPendingChunkIds: vi.fn(),
  },
}));

vi.mock('../core/storage/chunkCache', () => ({
  getInMemoryChunkIds: vi.fn(),
  getInMemoryChunkGraph: vi.fn(),
}));

describe('DebugPanel', () => {
  const mockMapEaseTo = vi.fn();
  const mockOnRefreshChunk = vi.fn();
  const mockSetDebugSubMode = vi.fn();
  const mockSetSelectedDebugChunkId = vi.fn();

  const mockGraph: StreetGraph = {
    nodes: new Map([
      [
        'n1',
        {
          node: { id: 'n1', lat: 48.13, lng: 11.58, tags: {} },
          edges: [{ target: 'n2', distance: 50, tags: {} }],
        },
      ],
      ['n2', { node: { id: 'n2', lat: 48.14, lng: 11.59, tags: {} }, edges: [] }],
    ]),
  };

  const mockRouteResult: RouteResult = {
    pathNodeIds: ['n1', 'n2'],
    totalDurationSeconds: 120,
    totalDistanceMeters: 500,
    streets: ['Main St'],
    trafficSignalsCount: 2,
    signalCount: 2,
    yieldCount: 0,
    crossingCount: 0,
    roadTypeTotals: {},
    surfaceTotals: { paved: 500, gravel: 0, cobblestone: 0 },
    coordinates: [
      [11.58, 48.13],
      [11.59, 48.14],
    ],
    edges: [
      {
        name: 'Main Street',
        highway: 'cycleway',
        distance: 300,
        cost: 60,
        matchedSign: 'Yield',
        matchedRoad: 'Cycleway',
        tags: { surface: 'asphalt' },
      },
      {
        name: 'Side Alley',
        highway: 'residential',
        distance: 200,
        cost: 60,
        tags: { lit: 'yes' },
      },
    ],
  };

  const mockVariants: StrategyRouteVariant[] = [
    {
      label: 'standard',
      result: mockRouteResult,
    },
  ];

  function createMockMapContext(overrides: Partial<MapContextType> = {}): MapContextType {
    return {
      graph: mockGraph,
      loadedBBoxes: [],
      startCoord: null,
      endCoord: null,
      routeVariants: mockVariants,
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
      showMinorControls: false,
      setShowMinorControls: vi.fn(),
      managedClusterId: null,
      setManagedClusterId: vi.fn(),
      managedNodeIds: [],
      setManagedNodeIds: vi.fn(),
      isInspectorModeActive: false,
      onToggleInspectorMode: vi.fn(),
      selectedNodeId: null,
      setSelectedNodeId: vi.fn(),
      selectedAlternativeTargetId: null,
      setSelectedAlternativeTargetId: vi.fn(),
      inspectorBranches: [],
      loadedChunkIds: ['4813,1158'],
      onRefreshChunk: mockOnRefreshChunk,
      debugSubMode: 'chunks',
      setDebugSubMode: mockSetDebugSubMode,
      selectedDebugChunkId: null,
      setSelectedDebugChunkId: mockSetSelectedDebugChunkId,
      map: { easeTo: mockMapEaseTo } as unknown as MapContextType['map'],
      ...overrides,
    } as unknown as MapContextType;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(OSMNetworkQueue.getPendingChunkIds).mockReturnValue([]);
    vi.mocked(chunkCache.getInMemoryChunkIds).mockReturnValue([]);
    vi.mocked(chunkCache.getInMemoryChunkGraph).mockReturnValue(undefined);
  });

  it('renders empty state when no chunks are cached in chunks sub-mode', () => {
    const ctx = createMockMapContext({ loadedChunkIds: [] });
    render(
      <MapContext.Provider value={ctx}>
        <DebugPanel />
      </MapContext.Provider>,
    );

    expect(screen.getByText('No Cached Chunks')).toBeInTheDocument();
    expect(
      screen.getByText('Pan or zoom the map to load street network chunks.'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 chunks')).toBeInTheDocument();
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
  });

  it('displays chunks with node/edge counts and badges', () => {
    vi.mocked(OSMNetworkQueue.getPendingChunkIds).mockReturnValue(['4815,1160']);
    vi.mocked(chunkCache.getInMemoryChunkIds).mockReturnValue(['4814,1159']);
    vi.mocked(chunkCache.getInMemoryChunkGraph).mockImplementation((chunkId: string) => {
      if (chunkId === '4813,1158') {
        return {
          nodes: new Map([
            [
              'c1',
              {
                node: { id: 'c1', lat: 48.13, lng: 11.58, tags: {} },
                edges: [{ target: 'c2', distance: 10, tags: {} }],
              },
            ],
          ]),
        };
      }
      return undefined;
    });

    const ctx = createMockMapContext({
      loadedChunkIds: ['4813,1158'],
    });

    render(
      <MapContext.Provider value={ctx}>
        <DebugPanel />
      </MapContext.Provider>,
    );

    expect(screen.getByText('3 chunks')).toBeInTheDocument();
    expect(screen.getByText('Chunk 4813,1158')).toBeInTheDocument();
    expect(screen.getByText('1 nodes · 1 edges')).toBeInTheDocument();
    expect(screen.getByText('Loaded')).toBeInTheDocument();

    expect(screen.getByText('Chunk 4814,1159')).toBeInTheDocument();
    expect(screen.getByText('Cached')).toBeInTheDocument();

    expect(screen.getByText('Chunk 4815,1160')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('selects chunk on click, centers map, and triggers refresh on refresh button click', async () => {
    const user = userEvent.setup();
    const ctx = createMockMapContext({
      loadedChunkIds: ['4813,1158'],
    });

    render(
      <MapContext.Provider value={ctx}>
        <DebugPanel />
      </MapContext.Provider>,
    );

    // Click chunk row
    const chunkRow = screen.getByText('Chunk 4813,1158');
    await user.click(chunkRow);

    expect(mockSetSelectedDebugChunkId).toHaveBeenCalledWith('4813,1158');
    expect(mockMapEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 300,
      }),
    );

    // Click refresh button
    const refreshBtn = screen.getByRole('button', { name: 'Refresh chunk 4813,1158' });
    await user.click(refreshBtn);

    expect(mockOnRefreshChunk).toHaveBeenCalledWith('4813,1158');
  });

  it('clears selected chunk on Escape key press', () => {
    const ctx = createMockMapContext({
      loadedChunkIds: ['4813,1158'],
      selectedDebugChunkId: '4813,1158',
    });

    render(
      <MapContext.Provider value={ctx}>
        <DebugPanel />
      </MapContext.Provider>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockSetSelectedDebugChunkId).toHaveBeenCalledWith(null);
  });

  it('switches between Cached Chunks and Route Edges sub-modes', async () => {
    const user = userEvent.setup();
    const ctx = createMockMapContext({
      debugSubMode: 'chunks',
    });

    render(
      <MapContext.Provider value={ctx}>
        <DebugPanel />
      </MapContext.Provider>,
    );

    const routeEdgesTab = screen.getByRole('button', { name: 'Route Edges' });
    await user.click(routeEdgesTab);

    expect(mockSetDebugSubMode).toHaveBeenCalledWith('route');
  });

  it('renders empty state in Route Edges sub-mode when no route is active', () => {
    const ctx = createMockMapContext({
      debugSubMode: 'route',
      routeVariants: [],
    });

    render(
      <MapContext.Provider value={ctx}>
        <DebugPanel routeResult={null} />
      </MapContext.Provider>,
    );

    expect(screen.getByText('No Active Route')).toBeInTheDocument();
    expect(
      screen.getByText('Place start and destination pins on the map to inspect route edges.'),
    ).toBeInTheDocument();
  });

  it('displays route edges in Route Edges sub-mode and copies JSON to clipboard', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    const ctx = createMockMapContext({
      debugSubMode: 'route',
    });

    render(
      <MapContext.Provider value={ctx}>
        <DebugPanel routeResult={mockRouteResult} />
      </MapContext.Provider>,
    );

    expect(screen.getByText('Route Edges (2)')).toBeInTheDocument();
    expect(screen.getByText('1. Main Street')).toBeInTheDocument();
    expect(screen.getByText('2. Side Alley')).toBeInTheDocument();
    expect(screen.getByText('Yield')).toBeInTheDocument();
    expect(screen.getByText('300m')).toBeInTheDocument();
    expect(screen.getByText('surface:')).toBeInTheDocument();
    expect(screen.getByText('asphalt')).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /Copy JSON/i });
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const parsedCopied = JSON.parse(writeTextMock.mock.calls[0][0]);
    expect(parsedCopied.totalDurationSeconds).toBe(120);
    expect(parsedCopied.edges).toHaveLength(2);
    expect(parsedCopied.edges[0].name).toBe('Main Street');

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });
});
