import { API_CONFIG } from '../common/constants';
import { doBBoxesIntersect } from '../common/geo';
import { logger } from '../common/logger';
import { addDataUsage, isDataSaverActive } from './dataUsage';

/**
 * Internal record for the in-memory spatial cache index.
 */
interface SpatialIndexEntry {
  bbox: [number, number, number, number];
  url: string;
  timestamp: number;
}

/**
 * In-memory spatial index maintaining cached bounding boxes and query URLs.
 * Initialized once on startup to avoid expensive O(N) CacheStorage scans on map pan.
 */
class SpatialCacheIndex {
  private entries = new Map<string, SpatialIndexEntry>();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (typeof caches === 'undefined') {
          this.initialized = true;
          return;
        }
        const cacheInstance = await caches.open(API_CONFIG.CACHE_NAME);
        const keys = await cacheInstance.keys();
        const promises = keys.map(async (req) => {
          const res = await cacheInstance.match(req);
          if (!res) return null;
          const timestampStr = res.headers.get('X-Cache-Timestamp');
          const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
          const urlObj = new URL(req.url);
          const bboxStr = urlObj.searchParams.get('bbox');
          if (bboxStr) {
            const coords = bboxStr.split(',').map(Number);
            if (coords.length === 4 && coords.every((c) => !isNaN(c))) {
              return {
                url: req.url,
                bbox: coords as [number, number, number, number],
                timestamp,
              };
            }
          }
          return null;
        });

        const results = await Promise.all(promises);
        for (const item of results) {
          if (item) {
            this.entries.set(item.url, item);
          }
        }
      } catch (err) {
        logger.warn('Failed to initialize spatial cache index:', err);
      } finally {
        this.initialized = true;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public addOrUpdate(url: string, bbox: [number, number, number, number], timestamp: number): void {
    this.entries.set(url, { url, bbox, timestamp });
  }

  public remove(url: string): void {
    this.entries.delete(url);
  }

  /**
   * Returns URLs of all indexed entries whose bounding box intersects targetBBox.
   *
   * @param targetBBox - Target bounding box [minLat, minLng, maxLat, maxLng].
   * @returns Array of matching request URLs.
   */
  public getIntersectingUrls(targetBBox: [number, number, number, number]): string[] {
    const urls: string[] = [];
    for (const entry of this.entries.values()) {
      if (doBBoxesIntersect(entry.bbox, targetBBox)) {
        urls.push(entry.url);
      }
    }
    return urls;
  }

  public getValid(ttl: number, dataSaver: boolean): ValidCacheEntry[] {
    const now = Date.now();
    const result: ValidCacheEntry[] = [];
    for (const entry of this.entries.values()) {
      if (now - entry.timestamp < ttl || dataSaver) {
        result.push({ bbox: entry.bbox, url: entry.url });
      }
    }
    return result;
  }

  public clear(): void {
    this.entries.clear();
    this.initialized = false;
    this.initPromise = null;
  }
}

export const spatialCacheIndex = new SpatialCacheIndex();

/**
 * Resets the in-memory spatial cache index (for tests and cache clearing).
 */
export function resetSpatialCacheIndex(): void {
  spatialCacheIndex.clear();
}

/**
 * Initializes the in-memory spatial cache index on startup.
 */
export async function initSpatialCacheIndex(): Promise<void> {
  await spatialCacheIndex.init();
}

/**
 * Invalidates cached Overpass queries that intersect the specified bounding box.
 * Evicts matching entries from both the in-memory spatial index and persistent CacheStorage.
 *
 * @param targetBBox - Bounding box to invalidate [minLat, minLng, maxLat, maxLng].
 */
export async function invalidateCacheForBBox(
  targetBBox: [number, number, number, number],
): Promise<void> {
  if (!spatialCacheIndex.isInitialized()) {
    await spatialCacheIndex.init();
  }

  const intersectingUrls = spatialCacheIndex.getIntersectingUrls(targetBBox);
  if (intersectingUrls.length === 0) return;

  let cacheInstance: Cache | null = null;
  if (typeof caches !== 'undefined' && typeof caches.open === 'function') {
    try {
      cacheInstance = await caches.open(API_CONFIG.CACHE_NAME);
    } catch (err) {
      logger.warn('Failed to open CacheStorage during cache invalidation:', err);
    }
  }

  for (const url of intersectingUrls) {
    spatialCacheIndex.remove(url);
    if (cacheInstance) {
      try {
        await cacheInstance.delete(new Request(url));
      } catch (err) {
        logger.warn(`Failed to delete cache entry ${url}:`, err);
      }
    }
  }
}

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
        spatialCacheIndex.remove(entry.req.url);
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
        const size = new TextEncoder().encode(text).byteLength;
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
        logger.log(
          'Cache entry is stale. Serving cached data to avoid uncoordinated background revalidation.',
        );
      }
    }
  } catch (e) {
    logger.warn('CacheStorage not available or query matching failed:', e);
  }

  const revalidate = async (): Promise<T> => {
    try {
      const freshData = await fetcher();
      if (cacheInstance) {
        const now = Date.now();
        await cacheInstance.put(
          cacheKey,
          new Response(JSON.stringify(freshData), {
            headers: {
              'Content-Type': 'application/json',
              'X-Cache-Timestamp': now.toString(),
            },
          }),
        );
        const urlObj = new URL(cacheKeyUrl);
        const bboxStr = urlObj.searchParams.get('bbox');
        if (bboxStr) {
          const coords = bboxStr.split(',').map(Number);
          if (coords.length === 4 && coords.every((c) => !isNaN(c))) {
            spatialCacheIndex.addOrUpdate(
              cacheKeyUrl,
              coords as [number, number, number, number],
              now,
            );
          }
        }
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
 * Returns currently valid cached bounding boxes using the in-memory spatial index.
 * Initialized once on startup to replace per-moveend full CacheStorage scans.
 */
export async function getValidCacheEntries(): Promise<ValidCacheEntry[]> {
  if (!spatialCacheIndex.isInitialized()) {
    await spatialCacheIndex.init();
  }
  return spatialCacheIndex.getValid(API_CONFIG.CACHE_TTL_MS, isDataSaverActive());
}
