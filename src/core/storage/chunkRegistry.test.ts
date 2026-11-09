import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GraphNode, NodeEntry, StreetGraph } from '../graph/types';
import { ChunkRegistry } from './chunkRegistry';

describe('ChunkRegistry', () => {
  let registry: ChunkRegistry;

  beforeEach(() => {
    registry = new ChunkRegistry();
  });

  const createDummyGraph = (
    entries: { id: string; lat: number; lng: number; edgeTargets?: string[] }[],
  ): StreetGraph => {
    const nodes = new Map<string, NodeEntry>();
    for (const item of entries) {
      const node: GraphNode = { id: item.id, lat: item.lat, lng: item.lng, tags: {} };
      const nodeEntry: NodeEntry = {
        node,
        edges: (item.edgeTargets ?? []).map((target) => ({
          target,
          distance: 10,
          tags: {},
        })),
      };
      nodes.set(item.id, nodeEntry);
    }
    return { nodes };
  };

  it('registers viewport and discovers chunks as uncached', () => {
    const listener = vi.fn();
    registry.subscribe(listener);

    // BBox encompassing 48.13, 11.57
    const chunkIds = registry.registerViewport([48.134, 11.574, 48.136, 11.576]);
    expect(chunkIds).toContain('4813,1157');
    expect(listener).toHaveBeenCalledTimes(1);

    const chunk = registry.getChunk('4813,1157');
    expect(chunk).toBeDefined();
    expect(chunk?.state).toBe('uncached');
    expect(chunk?.bbox).toEqual([48.13, 11.57, 48.14, 11.58]);
    expect(chunk?.nodeCount).toBe(0);
    expect(chunk?.edgeCount).toBe(0);

    expect(registry.getViewport()).toEqual([48.134, 11.574, 48.136, 11.576]);

    // Calling again with the same viewport should not re-trigger notifications if no new chunks
    registry.registerViewport([48.134, 11.574, 48.136, 11.576]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('registers cached chunks and upgrades uncached chunks', () => {
    const listener = vi.fn();
    registry.subscribe(listener);

    // Register viewport first
    registry.registerViewport([48.134, 11.574, 48.136, 11.576]);
    expect(registry.getChunk('4813,1157')?.state).toBe('uncached');

    // Register cached chunks: upgrades 4813,1157 to cached and adds 4814,1158 as cached
    registry.registerCachedChunks(['4813,1157', '4814,1158']);

    expect(registry.getChunk('4813,1157')?.state).toBe('cached');
    expect(registry.getChunk('4814,1158')?.state).toBe('cached');
    expect(registry.getChunk('4814,1158')?.bbox).toEqual([48.14, 11.58, 48.15, 11.59]);
  });

  it('updates chunk states and stats for single and multiple chunk IDs', () => {
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.setChunkState('4813,1157', 'pending');
    expect(registry.getChunk('4813,1157')?.state).toBe('pending');
    expect(listener).toHaveBeenCalledTimes(1);

    registry.setChunkState(['4813,1157', '4814,1158'], 'fetching');
    expect(registry.getChunk('4813,1157')?.state).toBe('fetching');
    expect(registry.getChunk('4814,1158')?.state).toBe('fetching');

    registry.setChunkState('4813,1157', 'loaded', { nodeCount: 42, edgeCount: 84 });
    const record = registry.getChunk('4813,1157');
    expect(record?.state).toBe('loaded');
    expect(record?.nodeCount).toBe(42);
    expect(record?.edgeCount).toBe(84);
  });

  it('updates chunk graph stats while filtering out boundary stub nodes', () => {
    // 4813,1157 covers lat [48.13, 48.14), lng [11.57, 11.58)
    // 4814,1158 covers lat [48.14, 48.15), lng [11.58, 11.59)
    const graph = createDummyGraph([
      { id: 'n1', lat: 48.135, lng: 11.575, edgeTargets: ['n2', 'boundary-stub'] },
      { id: 'n2', lat: 48.136, lng: 11.576, edgeTargets: ['n1'] },
      // Boundary stub node belonging to neighbor chunk 4814,1158
      { id: 'boundary-stub', lat: 48.141, lng: 11.581, edgeTargets: [] },
    ]);

    registry.updateChunkGraphStats('4813,1157', graph);

    const record = registry.getChunk('4813,1157');
    expect(record).toBeDefined();
    expect(record?.state).toBe('cached');
    // Only n1 and n2 belong to 4813,1157; boundary-stub is excluded
    expect(record?.nodeCount).toBe(2);
    // n1 has 2 outbound edges, n2 has 1 outbound edge => 3 total edges
    expect(record?.edgeCount).toBe(3);
  });

  it('provides a referentially stable snapshot until mutations occur', () => {
    const snap1 = registry.getSnapshot();
    expect(snap1).toEqual([]);
    expect(registry.getSnapshot()).toBe(snap1);

    registry.setChunkState('4813,1157', 'pending');
    const snap2 = registry.getSnapshot();
    expect(snap2).toHaveLength(1);
    expect(snap2).not.toBe(snap1);
    expect(registry.getSnapshot()).toBe(snap2);
    expect(registry.getAllChunks()).toBe(snap2);
  });

  it('resets all state and notifies subscribers', () => {
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.registerViewport([48.13, 11.57, 48.14, 11.58]);
    expect(registry.getAllChunks().length).toBeGreaterThan(0);
    expect(registry.getViewport()).not.toBeNull();

    registry.reset();
    expect(registry.getAllChunks()).toHaveLength(0);
    expect(registry.getViewport()).toBeNull();
    expect(registry.getChunk('4813,1157')).toBeUndefined();
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribes listeners cleanly', () => {
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.setChunkState('4813,1157', 'cached');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    registry.setChunkState('4813,1157', 'loaded');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
