import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWithCacheAndFallback } from './overpass';

describe('fetchWithCacheAndFallback', () => {
  let mockCache: Partial<Cache>;
  let mockCaches: Partial<CacheStorage>;
  let store: Map<string, Response>;

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
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

  it('performs standard foreground fetch and caches response if cache is empty', async () => {
    const mockJson = { elements: [] };
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify(mockJson),
      json: async () => mockJson,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchWithCacheAndFallback('[out:json]; node(1); out;');
    expect(result).toEqual(mockJson);
    expect(mockFetch).toHaveBeenCalled();
    expect(mockCache.put).toHaveBeenCalled();
  });

  it('serves from cache directly if cache entry is fresh (within TTL)', async () => {
    const mockJson = { elements: [{ id: 1 }] };
    const cacheKey =
      'https://overpass-interpreter-cache/?query=%5Bout%3Ajson%5D%3B%20node(1)%3B%20out%3B';
    const cachedResponse = new Response(JSON.stringify(mockJson), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache-Timestamp': Date.now().toString(),
      },
    });
    store.set(cacheKey, cachedResponse);

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchWithCacheAndFallback('[out:json]; node(1); out;');
    expect(result).toEqual(mockJson);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses stale cached response and triggers background revalidation if cache is stale', async () => {
    const mockOldJson = { elements: [{ id: 1 }] };
    const mockNewJson = { elements: [{ id: 2 }] };
    const cacheKey =
      'https://overpass-interpreter-cache/?query=%5Bout%3Ajson%5D%3B%20node(1)%3B%20out%3B';

    // Set old cached response with a timestamp 40 days ago (older than new 30-day TTL)
    const staleTime = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const cachedResponse = new Response(JSON.stringify(mockOldJson), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache-Timestamp': staleTime.toString(),
      },
    });
    store.set(cacheKey, cachedResponse);

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify(mockNewJson),
      json: async () => mockNewJson,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchWithCacheAndFallback('[out:json]; node(1); out;');
    // SWR returns old data immediately
    expect(result).toEqual(mockOldJson);

    // Wait briefly for background revalidation promise to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockFetch).toHaveBeenCalled();
    expect(mockCache.put).toHaveBeenCalled();
  });
});
