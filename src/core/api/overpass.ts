import { API_CONFIG } from '../common/constants';
import { logger } from '../common/logger';

/**
 * Helper to fetch Overpass query data by iterating over configured mirrors.
 */
async function fetchFromMirrors(query: string): Promise<unknown> {
  let lastError: Error | null = null;
  for (const baseUrl of API_CONFIG.OVERPASS_MIRRORS) {
    try {
      const url = `${baseUrl}?data=${encodeURIComponent(query)}`;
      logger.log(`Fetching Overpass query from mirror: ${baseUrl}`);
      const response = await fetch(url);

      if (response.status === 429) {
        throw new Error(`Mirror ${baseUrl} returned HTTP 429 Too Many Requests (Rate Limited).`);
      }
      if (!response.ok) {
        throw new Error(`Mirror ${baseUrl} returned error status: ${response.status}`);
      }

      return await response.json();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`Failed to fetch from ${baseUrl}:`, errorMsg);
      lastError = err instanceof Error ? err : new Error(errorMsg);
    }
  }

  throw lastError || new Error('All Overpass mirrors failed or returned rate limits.');
}

/**
 * Evicts oldest entries in the cache if the count exceeds the configured maximum.
 */
async function evictOldCacheEntries(cache: Cache, maxItems: number) {
  try {
    const keys = await cache.keys();
    if (keys.length <= maxItems) return;

    // Fetch all keys with their timestamps
    const entries = await Promise.all(
      keys.map(async (req) => {
        const res = await cache.match(req);
        const timestampStr = res?.headers.get('X-Cache-Timestamp');
        const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
        return { req, timestamp };
      }),
    );

    // Sort by timestamp ascending (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Delete oldest entries until we are within the limit
    const toDeleteCount = keys.length - maxItems;
    for (let i = 0; i < toDeleteCount; i++) {
      const entry = entries[i];
      if (entry) {
        await cache.delete(entry.req);
        logger.log(`Evicted stale cache entry: ${entry.req.url}`);
      }
    }
  } catch (err) {
    logger.warn('Failed to evict old cache entries:', err);
  }
}

/**
 * Fetch Overpass API data with client-side CacheStorage revalidation and mirror failover.
 * Implements Stale-While-Revalidate (SWR), cache TTL enforcement, and cache eviction.
 *
 * Note: We explicitly use the browser's native CacheStorage API (which writes to disk)
 * instead of in-memory caching libraries like React Query or SWR. Overpass API JSON
 * responses for entire cities can easily reach 50MB-150MB. Storing this in the JavaScript
 * heap would cause severe memory bloat or crash the browser tab.
 */
export async function fetchWithCacheAndFallback(query: string): Promise<unknown> {
  const cacheKey = new Request(
    `https://overpass-interpreter-cache/?query=${encodeURIComponent(query)}`,
  );

  let cachedData: unknown = null;
  let isStale = false;
  let cacheInstance: Cache | null = null;

  // 1. Try loading from client-side CacheStorage
  try {
    cacheInstance = await caches.open(API_CONFIG.CACHE_NAME);
    const cachedResponse = await cacheInstance.match(cacheKey);
    if (cachedResponse) {
      const timestampStr = cachedResponse.headers.get('X-Cache-Timestamp');
      const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
      const ttl = API_CONFIG.CACHE_TTL_MS;

      cachedData = await cachedResponse.json();
      if (Date.now() - timestamp < ttl) {
        logger.log('Serving fresh Overpass query from CacheStorage.');
        return cachedData;
      } else {
        logger.log('Cache entry is stale. Triggering background revalidation (SWR).');
        isStale = true;
      }
    }
  } catch (e) {
    logger.warn('CacheStorage not available or query matching failed:', e);
  }

  // 2. Define the background revalidation and cache updating logic
  const revalidate = async () => {
    try {
      const freshData = await fetchFromMirrors(query);
      if (cacheInstance) {
        await cacheInstance.put(
          cacheKey,
          new Response(JSON.stringify(freshData), {
            headers: {
              'Content-Type': 'application/json',
              'X-Cache-Timestamp': Date.now().toString(),
            },
          }),
        );
        // Evict older cache entries if max limit exceeded
        const maxItems = API_CONFIG.CACHE_MAX_ITEMS;
        await evictOldCacheEntries(cacheInstance, maxItems);
      }
      return freshData;
    } catch (err) {
      logger.warn('Background revalidation failed:', err);
      throw err;
    }
  };

  // 3. Handle Stale-While-Revalidate trigger
  if (isStale && cachedData) {
    // Run revalidation in the background asynchronously
    revalidate().catch(() => {});
    return cachedData;
  }

  // 4. Foreground fetch fallback if cache is totally empty
  return await revalidate();
}
