import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CONFIG } from '../common/constants';
import {
  fetchWithCacheAndFallback,
  getMirrorHealthSnapshot,
  resetMirrorStateForTesting,
} from './overpass';

describe('fetchWithCacheAndFallback', () => {
  let mockCache: Partial<Cache>;
  let mockCaches: Partial<CacheStorage>;
  let store: Map<string, Response>;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetMirrorStateForTesting();
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
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent('[out:json]; node(1); out;'),
      }),
    );
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

  it('serves stale cached response directly without firing background revalidation', async () => {
    const mockOldJson = { elements: [{ id: 1 }] };
    const cacheKey =
      'https://overpass-interpreter-cache/?query=%5Bout%3Ajson%5D%3B%20node(1)%3B%20out%3B';

    // Set old cached response with a timestamp 40 days ago (older than 30-day TTL)
    const staleTime = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const cachedResponse = new Response(JSON.stringify(mockOldJson), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache-Timestamp': staleTime.toString(),
      },
    });
    store.set(cacheKey, cachedResponse);

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchWithCacheAndFallback('[out:json]; node(1); out;');
    expect(result).toEqual(mockOldJson);

    // Wait briefly to confirm no background revalidation was triggered
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('configures the designated 5 mirrors and excludes regional and dead mirrors', () => {
    expect(API_CONFIG.OVERPASS_MIRRORS).toEqual([
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://z.overpass-api.de/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://ovp.dresel.systems/api/interpreter',
    ]);
    expect(API_CONFIG.OVERPASS_MIRRORS).not.toContain('https://overpass.osm.ch/api/interpreter');
    expect(API_CONFIG.OVERPASS_MIRRORS).not.toContain(
      'https://overpass.kumi.systems/api/interpreter',
    );
  });

  it('immediately fails over to next mirror on HTTP 502 without waiting inter-request cooldown', async () => {
    const mockJson = { elements: [{ id: 42 }] };
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'https://overpass-api.de/api/interpreter') {
        return {
          status: 502,
          ok: false,
          text: async () => '502 Bad Gateway',
        };
      }
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify(mockJson),
        json: async () => mockJson,
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const startTime = Date.now();
    const result = await fetchWithCacheAndFallback('[out:json]; node(42); out;');
    const elapsed = Date.now() - startTime;

    expect(result).toEqual(mockJson);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]?.[0]).toBe('https://overpass-api.de/api/interpreter');
    expect(mockFetch.mock.calls[1]?.[0]).toBe('https://lz4.overpass-api.de/api/interpreter');
    expect(elapsed).toBeLessThan(500);

    const snapshot = getMirrorHealthSnapshot();
    const deMirror = snapshot.find((m) => m.url === 'https://overpass-api.de/api/interpreter');
    expect(deMirror?.consecutiveFailures).toBe(1);
    expect(deMirror?.backoffUntil).toBeGreaterThan(Date.now());
  });

  it('prioritizes sticky successful mirror (e.g. private.coffee) and skips backed-off mirrors across sequential calls', async () => {
    const query1 = '[out:json]; node(101); out;';
    const query2 = '[out:json]; node(102); out;';
    const mockJson1 = { elements: [{ id: 101 }] };
    const mockJson2 = { elements: [{ id: 102 }] };

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = String(init?.body || '');
      if (
        url === 'https://overpass-api.de/api/interpreter' ||
        url === 'https://lz4.overpass-api.de/api/interpreter' ||
        url === 'https://z.overpass-api.de/api/interpreter'
      ) {
        return {
          status: 502,
          ok: false,
          text: async () => '502 Bad Gateway',
        };
      }
      if (url === 'https://overpass.private.coffee/api/interpreter') {
        const responseData = body.includes('101') ? mockJson1 : mockJson2;
        return {
          status: 200,
          ok: true,
          text: async () => JSON.stringify(responseData),
          json: async () => responseData,
        };
      }
      return {
        status: 500,
        ok: false,
        text: async () => '500 Server Error',
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    // Call 1: primary mirrors fail with 502, overpass.private.coffee succeeds with 200
    const result1 = await fetchWithCacheAndFallback(query1);
    expect(result1).toEqual(mockJson1);
    expect(mockFetch.mock.calls[0]?.[0]).toBe('https://overpass-api.de/api/interpreter');
    expect(mockFetch.mock.calls[1]?.[0]).toBe('https://lz4.overpass-api.de/api/interpreter');
    expect(mockFetch.mock.calls[2]?.[0]).toBe('https://z.overpass-api.de/api/interpreter');
    expect(mockFetch.mock.calls[3]?.[0]).toBe('https://overpass.private.coffee/api/interpreter');

    mockFetch.mockClear();

    // Call 2: query2 directly hits overpass.private.coffee first because earlier mirrors are in backoff and coffee had sticky success
    const result2 = await fetchWithCacheAndFallback(query2);
    expect(result2).toEqual(mockJson2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[0]).toBe('https://overpass.private.coffee/api/interpreter');
  });

  it('progresses exponential backoff through 5000ms, 10000ms, and 20000ms on consecutive failures', async () => {
    vi.useFakeTimers();
    try {
      const baseTime = 1_700_000_000_000;
      vi.setSystemTime(baseTime);

      const mockFetch = vi.fn().mockResolvedValue({
        status: 502,
        ok: false,
        text: async () => '502 Bad Gateway',
      });
      vi.stubGlobal('fetch', mockFetch);

      // Attempt 1: All mirrors fail with 502
      await expect(fetchWithCacheAndFallback('[out:json]; node(1); out;')).rejects.toThrow();
      let snapshot = getMirrorHealthSnapshot();
      let primary = snapshot.find((m) => m.url === 'https://overpass-api.de/api/interpreter')!;
      expect(primary.consecutiveFailures).toBe(1);
      expect(primary.backoffUntil).toBe(baseTime + 5000);

      // Advance past first backoff window
      const secondCallTime = baseTime + 6000;
      vi.setSystemTime(secondCallTime);

      // Attempt 2: All mirrors fail again
      await expect(fetchWithCacheAndFallback('[out:json]; node(2); out;')).rejects.toThrow();
      snapshot = getMirrorHealthSnapshot();
      primary = snapshot.find((m) => m.url === 'https://overpass-api.de/api/interpreter')!;
      expect(primary.consecutiveFailures).toBe(2);
      expect(primary.backoffUntil).toBe(secondCallTime + 10000);

      // Advance past second backoff window
      const thirdCallTime = secondCallTime + 11000;
      vi.setSystemTime(thirdCallTime);

      // Attempt 3: All mirrors fail again
      await expect(fetchWithCacheAndFallback('[out:json]; node(3); out;')).rejects.toThrow();
      snapshot = getMirrorHealthSnapshot();
      primary = snapshot.find((m) => m.url === 'https://overpass-api.de/api/interpreter')!;
      expect(primary.consecutiveFailures).toBe(3);
      expect(primary.backoffUntil).toBe(thirdCallTime + 20000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects HTTP 200 responses containing runtime error remark with empty elements and fails over', async () => {
    const errorPayload = {
      remark: 'runtime error: Query timed out after 25 seconds.',
      elements: [],
    };
    const healthyPayload = {
      elements: [{ id: 999, tags: { highway: 'cycleway' } }],
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'https://overpass-api.de/api/interpreter') {
        return {
          status: 200,
          ok: true,
          text: async () => JSON.stringify(errorPayload),
          json: async () => errorPayload,
        };
      }
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify(healthyPayload),
        json: async () => healthyPayload,
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchWithCacheAndFallback('[out:json]; node(999); out;');
    expect(result).toEqual(healthyPayload);

    // Assert failover happened from overpass-api.de to lz4.overpass-api.de
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]?.[0]).toBe('https://overpass-api.de/api/interpreter');
    expect(mockFetch.mock.calls[1]?.[0]).toBe('https://lz4.overpass-api.de/api/interpreter');

    // Assert first mirror tracked failure and backoff
    const snapshot = getMirrorHealthSnapshot();
    const failedMirror = snapshot.find((m) => m.url === 'https://overpass-api.de/api/interpreter');
    expect(failedMirror?.consecutiveFailures).toBe(1);
    expect(failedMirror?.backoffUntil).toBeGreaterThan(Date.now());

    // Assert cache stores healthy payload, not error remark
    expect(mockCache.put).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        text: expect.any(Function),
      }),
    );
  });

  it('rejects completely and does not cache if all mirrors return runtime error remarks', async () => {
    const errorPayload = {
      remark: 'runtime error: Query timed out after 25 seconds.',
      elements: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify(errorPayload),
      json: async () => errorPayload,
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchWithCacheAndFallback('[out:json]; node(9999); out;')).rejects.toThrow(
      /runtime error/i,
    );

    expect(mockCache.put).not.toHaveBeenCalled();
  });
});
