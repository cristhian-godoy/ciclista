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
});
