import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GraphNode, NodeEntry, StreetGraph } from '../graph/types';
import {
  clearChunkCache,
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
});
