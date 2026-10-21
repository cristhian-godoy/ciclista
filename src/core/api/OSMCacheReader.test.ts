import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as cacheModule from '../storage/cache';
import { clearChunkCache, saveParsedChunk } from '../storage/chunkCache';
import { OSMCacheReader } from './OSMCacheReader';

vi.mock('../storage/cache', () => ({
  getValidCacheEntries: vi.fn(),
}));

describe('OSMCacheReader service', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await clearChunkCache();
  });

  it('readChunks returns empty result for empty chunk list', async () => {
    const result = await OSMCacheReader.readChunks([]);
    expect(result.graph).toBeNull();
    expect(result.loadedChunkIds).toEqual([]);
    expect(result.missingChunkIds).toEqual([]);
  });

  it('readChunks parses cached chunks and identifies missing ones', async () => {
    const chunkIds = ['4813,1157', '4814,1157'];

    vi.spyOn(cacheModule, 'getValidCacheEntries').mockResolvedValue([
      {
        bbox: [48.13, 11.57, 48.14, 11.58],
        url: 'https://cache/url1',
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
        headers: new Headers({ 'Content-Length': '1024' }),
        text: async () => JSON.stringify(mockResponse),
      }),
    };
    vi.stubGlobal('caches', {
      open: async () => mockCache,
    });

    const result = await OSMCacheReader.readChunks(chunkIds);
    expect(result.loadedChunkIds).toContain('4813,1157');
    expect(result.missingChunkIds).toContain('4814,1157');
    expect(result.graph).not.toBeNull();
    expect(result.graph?.nodes.size).toBeGreaterThan(0);
  });

  it('merges pre-parsed chunks directly without scanning Overpass caches', async () => {
    const chunkId = '4813,1157';
    await saveParsedChunk(chunkId, {
      nodes: new Map([
        [
          'node-100',
          {
            node: { id: 'node-100', lat: 48.134, lng: 11.574, tags: {} },
            edges: [],
          },
        ],
      ]),
    });

    const getValidCacheSpy = vi.spyOn(cacheModule, 'getValidCacheEntries');
    getValidCacheSpy.mockClear();

    const result = await OSMCacheReader.readChunks([chunkId]);
    expect(result.loadedChunkIds).toEqual([chunkId]);
    expect(result.missingChunkIds).toEqual([]);
    expect(result.graph?.nodes.has('node-100')).toBe(true);
    // When all chunks are resolved from pre-parsed chunkCache, getValidCacheEntries is not even queried
    expect(getValidCacheSpy).not.toHaveBeenCalled();
  });
});
