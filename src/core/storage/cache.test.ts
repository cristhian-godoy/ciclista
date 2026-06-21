import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getValidCacheEntries } from './cache';

describe('cache storage utility', () => {
  let mockCache: Partial<Cache>;
  let mockCaches: Partial<CacheStorage>;
  let store: Map<string, Response>;

  beforeEach(() => {
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
    expect(validEntries[0].bbox).toEqual([48.13, 11.57, 48.14, 11.58]);
  });
});
