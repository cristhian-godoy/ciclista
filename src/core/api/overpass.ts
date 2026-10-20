import { API_CONFIG } from '../common/constants';
import { logger } from '../common/logger';
import { fetchWithCache } from '../storage/cache';
import { addDataUsage } from '../storage/dataUsage';

let lastRequestTime = 0;
const INTER_REQUEST_COOLDOWN_MS = 1000;

/**
 * Helper to fetch Overpass query data by iterating over configured mirrors.
 */
async function fetchFromMirrors(query: string): Promise<unknown> {
  let lastError: Error | null = null;
  for (const baseUrl of API_CONFIG.OVERPASS_MIRRORS) {
    try {
      const timeSinceLast = Date.now() - lastRequestTime;
      if (timeSinceLast < INTER_REQUEST_COOLDOWN_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, INTER_REQUEST_COOLDOWN_MS - timeSinceLast),
        );
      }

      lastRequestTime = Date.now();
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'data=' + encodeURIComponent(query),
      });

      if (response.status === 429) {
        const retryAfter = response.headers?.get('Retry-After');
        const backoffMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        throw new Error(`Mirror ${baseUrl} returned HTTP 429 Too Many Requests (Rate Limited).`);
      }
      if (!response.ok) {
        throw new Error(`Mirror ${baseUrl} returned error status: ${response.status}`);
      }

      const text = await response.text();
      try {
        const bytes = new TextEncoder().encode(text).byteLength;
        addDataUsage(bytes, false);
      } catch (e) {
        logger.warn('Failed to calculate downloaded response size:', e);
      }
      return JSON.parse(text);
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
 * responses for entire cities can reach up to 50MB-150MB. Storing this in the JavaScript
 * heap would cause severe memory bloat or crash the browser tab.
 */
export async function fetchWithCacheAndFallback(query: string): Promise<unknown> {
  const match = query.match(
    /\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/,
  );
  const bboxParam = match ? `&bbox=${match[1]},${match[2]},${match[3]},${match[4]}` : '';
  const cacheKeyUrl = `https://overpass-interpreter-cache/?query=${encodeURIComponent(query)}${bboxParam}`;
  return fetchWithCache(cacheKeyUrl, () => fetchFromMirrors(query));
}
