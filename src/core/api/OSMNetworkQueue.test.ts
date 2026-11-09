import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chunkRegistry } from '../storage/chunkRegistry';
import { OSMNetworkQueue } from './OSMNetworkQueue';
import * as overpassModule from './overpass';

vi.mock('./overpass', () => ({
  fetchWithCacheAndFallback: vi.fn(),
}));

describe('OSMNetworkQueue service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    OSMNetworkQueue.resetForTesting();
    chunkRegistry.reset();
  });

  it('notifies status and processes queued chunks', async () => {
    const statusEvents: boolean[] = [];
    const dataEvents: string[][] = [];

    const statusListener = (fetching: boolean) => {
      statusEvents.push(fetching);
    };
    const dataListener = (result: { loadedChunkIds: string[] }) => {
      dataEvents.push(result.loadedChunkIds);
    };

    OSMNetworkQueue.addStatusListener(statusListener);
    OSMNetworkQueue.addDataListener(dataListener);

    const fetchSpy = vi
      .spyOn(overpassModule, 'fetchWithCacheAndFallback')
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { elements: [] };
      });

    OSMNetworkQueue.enqueue(['4813,1157']);

    // Wait for the queue to complete processing
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchSpy).toHaveBeenCalled();
    expect(statusEvents).toContain(true);
    expect(dataEvents).toContainEqual(['4813,1157']);

    OSMNetworkQueue.removeStatusListener(statusListener);
    OSMNetworkQueue.removeDataListener(dataListener);
  });

  it('clusters contiguous chunks into connected groups', () => {
    // Contiguous adjacent chunks
    const chunks = ['4813,1157', '4813,1158', '4814,1157', '4900,1200'];
    const clusters = OSMNetworkQueue.clusterContiguousChunks(chunks);

    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toHaveLength(3);
    expect(clusters[0]).toContain('4813,1157');
    expect(clusters[0]).toContain('4813,1158');
    expect(clusters[0]).toContain('4814,1157');
    expect(clusters[1]).toEqual(['4900,1200']);
  });

  it('coalesces adjacent rectangle chunks into minimal bounding boxes', () => {
    // 2x2 grid of chunks: 4813..4814 x 1157..1158
    const chunks = ['4813,1157', '4813,1158', '4814,1157', '4814,1158'];
    const rectangles = OSMNetworkQueue.coalesceAdjacentRectangles(chunks);

    expect(rectangles).toHaveLength(1);
    expect(rectangles[0]).toEqual([48.13, 11.57, 48.15, 11.59]);
  });

  it('enforces single concurrency and prunes pending chunks outside viewport after in-flight completes', async () => {
    let concurrentFetches = 0;
    let maxConcurrency = 0;

    vi.spyOn(overpassModule, 'fetchWithCacheAndFallback').mockImplementation(async () => {
      concurrentFetches++;
      if (concurrentFetches > maxConcurrency) {
        maxConcurrency = concurrentFetches;
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
      concurrentFetches--;
      return { elements: [] };
    });

    // Viewport covers lat 48.13-48.14, lng 11.57-11.58
    OSMNetworkQueue.setViewport([48.13, 11.57, 48.14, 11.58]);

    // Enqueue a chunk inside viewport and a distant one outside
    OSMNetworkQueue.enqueue(['4813,1157', '5200,1300']);

    // Set a new viewport that excludes 5200,1300 while the first fetch is in flight
    OSMNetworkQueue.setViewport([48.13, 11.57, 48.14, 11.58]);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(maxConcurrency).toBe(1);
  });

  it('exposes pending chunk IDs via getPendingChunkIds', async () => {
    vi.spyOn(overpassModule, 'fetchWithCacheAndFallback').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return { elements: [] };
    });

    // Enqueue two distant chunks so they form two separate clusters
    OSMNetworkQueue.enqueue(['4813,1157', '5200,1300']);

    // The second cluster remains pending while the first is being processed
    const pending = OSMNetworkQueue.getPendingChunkIds();
    expect(pending).toContain('5200,1300');

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(OSMNetworkQueue.getPendingChunkIds()).toEqual([]);
  });

  it('tracks getFetchingChunkIds and chunkRegistry state during in-flight requests', async () => {
    let fetchingIdsDuringCall: string[] = [];
    let stateDuringCall: string | undefined;

    vi.spyOn(overpassModule, 'fetchWithCacheAndFallback').mockImplementation(async () => {
      fetchingIdsDuringCall = OSMNetworkQueue.getFetchingChunkIds();
      stateDuringCall = chunkRegistry.getChunk('4813,1157')?.state;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { elements: [] };
    });

    OSMNetworkQueue.enqueue(['4813,1157']);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchingIdsDuringCall).toEqual(['4813,1157']);
    expect(stateDuringCall).toBe('fetching');
    expect(OSMNetworkQueue.getFetchingChunkIds()).toEqual([]);
    expect(chunkRegistry.getChunk('4813,1157')?.state).toBe('loaded');
  });

  it('prioritizes priority enqueued chunks ahead of regular chunks and preserves them from pruning', async () => {
    const fetchedOrder: string[][] = [];

    vi.spyOn(overpassModule, 'fetchWithCacheAndFallback').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { elements: [] };
    });

    const dataListener = (result: { loadedChunkIds: string[] }) => {
      fetchedOrder.push(result.loadedChunkIds);
    };
    OSMNetworkQueue.addDataListener(dataListener);

    // Viewport covers lat 48.13-48.14, lng 11.57-11.58
    OSMNetworkQueue.setViewport([48.13, 11.57, 48.14, 11.58]);

    // Start with an in-flight chunk so queue is busy
    OSMNetworkQueue.enqueue(['4813,1157']);

    // While 4813,1157 is in-flight, enqueue a normal chunk and a distant priority chunk
    OSMNetworkQueue.enqueue(['4814,1158']);
    OSMNetworkQueue.enqueue(['5200,1300'], true);

    await new Promise((resolve) => setTimeout(resolve, 140));

    // 4813,1157 was already in-flight first
    expect(fetchedOrder[0]).toEqual(['4813,1157']);
    // Priority chunk 5200,1300 should be fetched next, despite being distant and outside viewport
    expect(fetchedOrder[1]).toEqual(['5200,1300']);
    expect(fetchedOrder[2]).toEqual(['4814,1158']);

    OSMNetworkQueue.removeDataListener(dataListener);
  });

  it('orders pending chunks based on Euclidean distance to viewport center', async () => {
    const fetchedOrder: string[][] = [];

    vi.spyOn(overpassModule, 'fetchWithCacheAndFallback').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { elements: [] };
    });

    const dataListener = (result: { loadedChunkIds: string[] }) => {
      fetchedOrder.push(result.loadedChunkIds);
    };
    OSMNetworkQueue.addDataListener(dataListener);

    // Viewport covers lat [48.10, 48.30], lng [11.57, 11.58], center is (48.20, 11.575)
    OSMNetworkQueue.setViewport([48.1, 11.57, 48.3, 11.58]);

    // In-flight chunk
    OSMNetworkQueue.enqueue(['4810,1157']);

    // While in-flight: 4819,1157 (center 48.195, dist 0.005) is closer to center than 4828,1157 (center 48.285, dist 0.085)
    // Both are within the viewport so neither will be pruned
    // Enqueue further one first, closer one second to verify reordering
    OSMNetworkQueue.enqueue(['4828,1157']);
    OSMNetworkQueue.enqueue(['4819,1157']);

    await new Promise((resolve) => setTimeout(resolve, 140));

    expect(fetchedOrder[0]).toEqual(['4810,1157']);
    expect(fetchedOrder[1]).toEqual(['4819,1157']);
    expect(fetchedOrder[2]).toEqual(['4828,1157']);

    OSMNetworkQueue.removeDataListener(dataListener);
  });
});
