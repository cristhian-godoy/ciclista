import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchWithCache,
  getValidCacheEntries,
  initSpatialCacheIndex,
  invalidateCacheForBBox,
  resetSpatialCacheIndex,
} from './cache';

describe('cache storage utility', () => {
  let mockCache: Partial<Cache>;
  let mockCaches: Partial<CacheStorage>;
  let store: Map<string, Response>;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetSpatialCacheIndex();
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

    mockCaches = {
      open: vi.fn(async () => mockCache as Cache),
    };

    vi.stubGlobal('caches', mockCaches);
  });

  it('getValidCacheEntries should retrieve cache entries with parsed bounding boxes', async () => {
    const freshTimestamp = Date.now().toString();
    const staleTimestamp = (Date.now() - 40 * 24 * 60 * 60 * 1000).toString();

    // 1. Fresh entry with bbox
    store.set(
      'https://overpass-interpreter-cache/?query=abc&bbox=48.13,11.57,48.14,11.58',
      new Response('{"elements": []}', {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Timestamp': freshTimestamp,
        },
      }),
    );

    // 2. Stale entry with bbox
    store.set(
      'https://overpass-interpreter-cache/?query=def&bbox=52.37,4.89,52.38,4.90',
      new Response('{"elements": []}', {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Timestamp': staleTimestamp,
        },
      }),
    );

    // 3. Entry without bbox
    store.set(
      'https://overpass-interpreter-cache/?query=xyz',
      new Response('{"elements": []}', {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Timestamp': freshTimestamp,
        },
      }),
    );

    const validEntries = await getValidCacheEntries();
    expect(validEntries).toHaveLength(1);
    expect(validEntries[0]?.bbox).toEqual([48.13, 11.57, 48.14, 11.58]);

    // Subsequent calls return from memory without rescanning keys
    const keysMock = mockCache.keys as ReturnType<typeof vi.fn>;
    keysMock.mockClear();

    const cachedEntries = await getValidCacheEntries();
    expect(cachedEntries).toHaveLength(1);
    expect(keysMock).not.toHaveBeenCalled();
  });

  it('fetchWithCache dynamically updates the in-memory spatial cache index on put', async () => {
    await initSpatialCacheIndex();

    const initialEntries = await getValidCacheEntries();
    expect(initialEntries).toHaveLength(0);

    const testUrl = 'https://overpass-interpreter-cache/?query=test&bbox=48.20,11.60,48.21,11.61';
    await fetchWithCache(testUrl, async () => ({ elements: [] }));

    const updatedEntries = await getValidCacheEntries();
    expect(updatedEntries).toHaveLength(1);
    expect(updatedEntries[0]?.bbox).toEqual([48.2, 11.6, 48.21, 11.61]);
  });

  it('invalidateCacheForBBox removes intersecting entries from spatial index and CacheStorage', async () => {
    const timestamp = Date.now().toString();
    const url1 = 'https://overpass-interpreter-cache/?query=1&bbox=48.13,11.57,48.14,11.58';
    const url2 = 'https://overpass-interpreter-cache/?query=2&bbox=52.37,4.89,52.38,4.90';

    store.set(
      url1,
      new Response('{"elements": []}', {
        headers: { 'Content-Type': 'application/json', 'X-Cache-Timestamp': timestamp },
      }),
    );
    store.set(
      url2,
      new Response('{"elements": []}', {
        headers: { 'Content-Type': 'application/json', 'X-Cache-Timestamp': timestamp },
      }),
    );

    // Initial load populates the spatial index
    const valid = await getValidCacheEntries();
    expect(valid).toHaveLength(2);

    // Invalidate bounding box covering Munich (48.13..48.14)
    await invalidateCacheForBBox([48.135, 11.575, 48.139, 11.579]);

    expect(store.has(url1)).toBe(false);
    expect(store.has(url2)).toBe(true);

    const remaining = await getValidCacheEntries();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.url).toBe(url2);
  });
});
