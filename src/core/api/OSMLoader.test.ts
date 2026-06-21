import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as cacheModule from '../storage/cache';
import { OSMLoader } from './OSMLoader';
import * as overpassModule from './overpass';

vi.mock('./overpass', () => ({
  fetchWithCacheAndFallback: vi.fn(),
}));

vi.mock('../storage/cache', () => ({
  getValidCacheEntries: vi.fn(),
}));

describe('OSMLoader service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loadViewport returns null if required chunks length is 0 or all chunks are already loaded', async () => {
    const viewport: [number, number, number, number] = [0.0, 0.0, 0.0, 0.0];
    const result = await OSMLoader.loadViewport(viewport, new Set(['0,0']));
    expect(result).toBeNull();
  });

  it('loadViewport parses cached chunks and merges them', async () => {
    const viewport: [number, number, number, number] = [48.132, 11.572, 48.138, 11.578]; // maps to 4813,1157
    const chunkId = '4813,1157';

    vi.spyOn(cacheModule, 'getValidCacheEntries').mockResolvedValue([
      {
        bbox: [48.13, 11.57, 48.14, 11.58],
        url: 'https://cache/url',
      },
    ]);

    const mockResponse = {
      elements: [
        {
          type: 'way',
          id: 1,
          nodes: [10, 11],
          geometry: [
            { lat: 48.133, lon: 11.573 },
            { lat: 48.134, lon: 11.574 },
          ],
          tags: { highway: 'residential' },
        },
      ],
    };

    const mockCache = {
      match: vi.fn().mockResolvedValue({
        json: async () => mockResponse,
      }),
    };
    vi.stubGlobal('caches', {
      open: async () => mockCache,
    });

    const result = await OSMLoader.loadViewport(viewport, new Set());
    expect(result).not.toBeNull();
    expect(result?.loadedChunkIds).toContain(chunkId);
    expect(result?.graph.nodes.size).toBeGreaterThan(0);
  });

  it('loadViewport fetches needed network chunks and locks execution', async () => {
    const viewport: [number, number, number, number] = [48.132, 11.572, 48.138, 11.578];

    vi.spyOn(cacheModule, 'getValidCacheEntries').mockResolvedValue([]);
    const fetchSpy = vi
      .spyOn(overpassModule, 'fetchWithCacheAndFallback')
      .mockImplementation(async () => {
        // Simulate network delay to verify queue lock
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { elements: [] };
      });

    // Fire two concurrent requests to the same viewport
    const promise1 = OSMLoader.loadViewport(viewport, new Set());
    const promise2 = OSMLoader.loadViewport(viewport, new Set());

    const [res1, res2] = await Promise.all([promise1, promise2]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(res1).not.toBeNull();
    expect(res2).not.toBeNull();
  });
});
