import { API_CONFIG } from '../common/constants';
import { logger } from '../common/logger';
import { fetchWithCache } from '../storage/cache';

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
 * Fetch Overpass API data with client-side CacheStorage revalidation and mirror failover.
 * Implements Stale-While-Revalidate (SWR), cache TTL enforcement, and cache eviction.
 *
 * Note: We explicitly use the browser's native CacheStorage API (which writes to disk)
 * instead of in-memory caching libraries like React Query or SWR. Overpass API JSON
 * responses for entire cities can easily reach 50MB-150MB. Storing this in the JavaScript
 * heap would cause severe memory bloat or crash the browser tab.
 */
export async function fetchWithCacheAndFallback(query: string): Promise<unknown> {
  const cacheKeyUrl = `https://overpass-interpreter-cache/?query=${encodeURIComponent(query)}`;
  return fetchWithCache(cacheKeyUrl, () => fetchFromMirrors(query));
}
