import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GraphNode, NodeEntry, StreetGraph } from '../graph/types';
import {
  clearChunkCache,
  evictParsedChunk,
  getAllCachedChunkIds,
  getInMemoryChunkGraph,
  getInMemoryChunkIds,
  hasParsedChunkInMemory,
  loadParsedChunk,
  saveParsedChunk,
  saveParsedGraphByChunks,
} from './chunkCache';

describe('chunkCache utility', () => {
  let store: Map<string, Response>;
  let mockCache: Partial<Cache>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    store = new Map<string, Response>();

    mockCache = {
      match: vi.fn(async (req: Request) => store.get(req.url)),
      put: vi.fn(async (req: Request, res: Response) => {
        store.set(req.url, res);
      }),
      keys: vi.fn(async () => Array.from(store.keys()).map((url) => new Request(url))),
      delete: vi.fn(async (req: Request) => {
        store.delete(req.url);
        return true;
      }),
    };

    vi.stubGlobal('caches', {
      open: vi.fn(async () => mockCache as Cache),
      delete: vi.fn(async () => true),
    });

    await clearChunkCache();
  });

  const createDummyGraph = (id: string, lat: number, lng: number): StreetGraph => {
    const node: GraphNode = { id, lat, lng, tags: {} };
    const entry: NodeEntry = { node, edges: [] };
    return {
      nodes: new Map([[id, entry]]),
    };
  };

  it('saves and loads parsed chunk from in-memory cache directly', async () => {
    const chunkId = '4813,1157';
    const graph = createDummyGraph('node-1', 48.134, 11.574);

    await saveParsedChunk(chunkId, graph);
    expect(hasParsedChunkInMemory(chunkId)).toBe(true);

    const loaded = await loadParsedChunk(chunkId);
    expect(loaded).not.toBeNull();
    expect(loaded?.nodes.has('node-1')).toBe(true);
  });

  it('partitions and saves StreetGraph by chunks', async () => {
    const node1: GraphNode = { id: 'n1', lat: 48.134, lng: 11.574, tags: {} };
    const node2: GraphNode = { id: 'n2', lat: 48.145, lng: 11.585, tags: {} };
    const fullGraph: StreetGraph = {
      nodes: new Map([
        ['n1', { node: node1, edges: [] }],
        ['n2', { node: node2, edges: [] }],
      ]),
    };

    await saveParsedGraphByChunks(fullGraph, ['4813,1157', '4814,1158']);

    const c1 = await loadParsedChunk('4813,1157');
    const c2 = await loadParsedChunk('4814,1158');

    expect(c1?.nodes.has('n1')).toBe(true);
    expect(c1?.nodes.has('n2')).toBe(false);
    expect(c2?.nodes.has('n2')).toBe(true);
    expect(c2?.nodes.has('n1')).toBe(false);
  });

  it('retrieves persistent chunk from CacheStorage when in-memory cache is wiped', async () => {
    const chunkId = '4813,1157';
    const graph = createDummyGraph('node-persisted', 48.134, 11.574);

    await saveParsedChunk(chunkId, graph);

    // Simulate in-memory wipe without clearing persistent cache
    await clearChunkCache();
    expect(hasParsedChunkInMemory(chunkId)).toBe(false);

    // Re-populate mockCache store so loadParsedChunk can read it
    const entries = Array.from(graph.nodes.entries());
    store.set(
      `https://ciclista-chunk-cache/chunk/${chunkId}`,
      new Response(JSON.stringify(entries), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Timestamp': Date.now().toString(),
        },
      }),
    );

    const restored = await loadParsedChunk(chunkId);
    expect(restored).not.toBeNull();
    expect(restored?.nodes.has('node-persisted')).toBe(true);
    expect(hasParsedChunkInMemory(chunkId)).toBe(true);
  });

  it('inspects in-memory chunk IDs and parsed graphs', async () => {
    expect(getInMemoryChunkIds()).toEqual([]);
    expect(getInMemoryChunkGraph('4813,1157')).toBeUndefined();

    const g1 = createDummyGraph('node-1', 48.134, 11.574);
    const g2 = createDummyGraph('node-2', 48.145, 11.585);

    await saveParsedChunk('4813,1157', g1);
    await saveParsedChunk('4814,1158', g2);

    const ids = getInMemoryChunkIds();
    expect(ids).toHaveLength(2);
    expect(ids).toContain('4813,1157');
    expect(ids).toContain('4814,1158');

    expect(getInMemoryChunkGraph('4813,1157')).toBe(g1);
    expect(getInMemoryChunkGraph('4814,1158')).toBe(g2);
    expect(getInMemoryChunkGraph('9999,9999')).toBeUndefined();
  });

  it('combines in-memory and CacheStorage chunk IDs via getAllCachedChunkIds', async () => {
    const g1 = createDummyGraph('node-mem', 48.134, 11.574);
    await saveParsedChunk('4813,1157', g1);

    // Simulate an additional chunk existing only in CacheStorage
    store.set(
      'https://ciclista-chunk-cache/chunk/4814,1158',
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    // And an unrelated key that does not match the prefix
    store.set('https://ciclista-chunk-cache/other/test', new Response('{}'));

    const allIds = await getAllCachedChunkIds();
    expect(allIds).toHaveLength(2);
    expect(allIds).toContain('4813,1157');
    expect(allIds).toContain('4814,1158');
  });

  it('evicts parsed chunk from both memory and CacheStorage via evictParsedChunk', async () => {
    const chunkId = '4813,1157';
    const graph = createDummyGraph('node-to-evict', 48.134, 11.574);

    await saveParsedChunk(chunkId, graph);
    expect(hasParsedChunkInMemory(chunkId)).toBe(true);
    expect(store.has(`https://ciclista-chunk-cache/chunk/${chunkId}`)).toBe(true);

    await evictParsedChunk(chunkId);

    expect(hasParsedChunkInMemory(chunkId)).toBe(false);
    expect(getInMemoryChunkGraph(chunkId)).toBeUndefined();
    expect(store.has(`https://ciclista-chunk-cache/chunk/${chunkId}`)).toBe(false);
    expect(mockCache.delete).toHaveBeenCalledWith(
      expect.objectContaining({ url: `https://ciclista-chunk-cache/chunk/${chunkId}` }),
    );
  });
});
