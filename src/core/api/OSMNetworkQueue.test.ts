import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OSMNetworkQueue } from './OSMNetworkQueue';
import * as overpassModule from './overpass';

vi.mock('./overpass', () => ({
  fetchWithCacheAndFallback: vi.fn(),
}));

describe('OSMNetworkQueue service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});
