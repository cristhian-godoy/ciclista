import { API_CONFIG } from '../common/constants';

export async function fetchWithCacheAndFallback(query: string): Promise<unknown> {
  const cacheKey = new Request(
    `https://overpass-interpreter-cache/?query=${encodeURIComponent(query)}`,
  );

  // Try loading from client-side CacheStorage
  try {
    const cache = await caches.open(API_CONFIG.CACHE_NAME);
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      console.log('Serving Overpass query from client-side CacheStorage.');
      return await cachedResponse.json();
    }
  } catch (e) {
    console.warn('CacheStorage not available or query matching failed:', e);
  }

  // Iterate over available public mirrors to fetch the data
  let lastError: Error | null = null;
  for (const baseUrl of API_CONFIG.OVERPASS_MIRRORS) {
    try {
      const url = `${baseUrl}?data=${encodeURIComponent(query)}`;
      console.log(`Fetching Overpass query from mirror: ${baseUrl}`);
      const response = await fetch(url);

      if (response.status === 429) {
        throw new Error(`Mirror ${baseUrl} returned HTTP 429 Too Many Requests (Rate Limited).`);
      }
      if (!response.ok) {
        throw new Error(`Mirror ${baseUrl} returned error status: ${response.status}`);
      }

      const data = await response.json();

      // Put successful response into client-side CacheStorage
      try {
        const cache = await caches.open(API_CONFIG.CACHE_NAME);
        await cache.put(
          cacheKey,
          new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      } catch (cacheErr) {
        console.warn('Failed to cache successful Overpass response:', cacheErr);
      }

      return data;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to fetch from ${baseUrl}:`, errorMsg);
      lastError = err instanceof Error ? err : new Error(errorMsg);
    }
  }

  throw lastError || new Error('All Overpass mirrors failed or returned rate limits.');
}
