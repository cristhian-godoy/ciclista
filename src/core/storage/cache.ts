import { API_CONFIG } from '../common/constants';
import { logger } from '../common/logger';
import { addDataUsage, isDataSaverActive } from './dataUsage';

/**
 * Evicts oldest entries in the cache if the count exceeds the configured maximum.
 */
async function evictOldCacheEntries(cache: Cache, maxItems: number): Promise<void> {
  try {
    const keys = await cache.keys();
    if (keys.length <= maxItems) return;

    const entries = await Promise.all(
      keys.map(async (req) => {
        const res = await cache.match(req);
        const timestampStr = res?.headers.get('X-Cache-Timestamp');
        const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
        return { req, timestamp };
      }),
    );

    entries.sort((a, b) => a.timestamp - b.timestamp);

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
 * Fetches data using the provided fetcher function, wrapping it with cache storage.
 * Implements stale-while-revalidate (SWR) behavior with cache TTL and size-based eviction.
 */
export async function fetchWithCache<T>(
  cacheKeyUrl: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cacheKey = new Request(cacheKeyUrl);

  let cachedData: T | null = null;
  let isStale = false;
  let cacheInstance: Cache | null = null;

  try {
    cacheInstance = await caches.open(API_CONFIG.CACHE_NAME);
    const cachedResponse = await cacheInstance.match(cacheKey);
    if (cachedResponse) {
      const timestampStr = cachedResponse.headers.get('X-Cache-Timestamp');
      const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
      const ttl = API_CONFIG.CACHE_TTL_MS;

      const text = await cachedResponse.text();
      try {
        const size = new Blob([text]).size;
        addDataUsage(size, true);
      } catch (e) {
        logger.warn('Failed to estimate cached data size:', e);
      }
      cachedData = JSON.parse(text) as T;

      if (Date.now() - timestamp < ttl) {
        logger.log('Serving fresh Overpass query from CacheStorage.');
        return cachedData;
      } else {
        isStale = true;
        if (isDataSaverActive()) {
          logger.log(
            'Cache entry is stale, but Data Saver is active. Serving stale data to save bandwidth.',
          );
          return cachedData;
        }
        logger.log('Cache entry is stale. Triggering background revalidation (SWR).');
      }
    }
  } catch (e) {
    logger.warn('CacheStorage not available or query matching failed:', e);
  }

  const revalidate = async (): Promise<T> => {
    try {
      const freshData = await fetcher();
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
        const maxItems = API_CONFIG.CACHE_MAX_ITEMS;
        await evictOldCacheEntries(cacheInstance, maxItems);
      }
      return freshData;
    } catch (err) {
      logger.warn('Background revalidation failed:', err);
      throw err;
    }
  };

  if (isStale && cachedData) {
    revalidate().catch(() => {});
    return cachedData;
  }

  return await revalidate();
}

/**
 * Represents a valid cache entry with its bounding box and URL identifier.
 */
export interface ValidCacheEntry {
  bbox: [number, number, number, number];
  url: string;
}

/**
 * Returns currently valid cached bounding boxes by scanning CacheStorage.
 */
export async function getValidCacheEntries(): Promise<ValidCacheEntry[]> {
  const validEntries: ValidCacheEntry[] = [];
  try {
    const cacheInstance = await caches.open(API_CONFIG.CACHE_NAME);
    const keys = await cacheInstance.keys();
    const ttl = API_CONFIG.CACHE_TTL_MS;
    const now = Date.now();
    const dataSaver = isDataSaverActive();

    for (const req of keys) {
      const res = await cacheInstance.match(req);
      if (!res) continue;

      const timestampStr = res.headers.get('X-Cache-Timestamp');
      const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;

      if (now - timestamp < ttl || dataSaver) {
        const urlObj = new URL(req.url);
        const bboxStr = urlObj.searchParams.get('bbox');
        if (bboxStr) {
          const coords = bboxStr.split(',').map(Number);
          if (coords.length === 4 && coords.every((c) => !isNaN(c))) {
            validEntries.push({
              bbox: coords as [number, number, number, number],
              url: req.url,
            });
          }
        }
      }
    }
  } catch (err) {
    logger.warn('Failed to scan CacheStorage for valid entries:', err);
  }
  return validEntries;
}
