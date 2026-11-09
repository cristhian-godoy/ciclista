import { API_CONFIG } from '../common/constants';
import { logger } from '../common/logger';
import { fetchWithCache } from '../storage/cache';
import { addDataUsage } from '../storage/dataUsage';

/**
 * Tracks runtime health, cooldown, and exponential backoff metrics for an Overpass mirror.
 */
export interface MirrorHealthState {
  url: string;
  consecutiveFailures: number;
  backoffUntil: number;
  lastRequestTime: number;
  lastSuccessTime: number;
}

/**
 * Minimum cooldown interval in milliseconds enforced between consecutive requests to the same mirror.
 */
export const INTER_REQUEST_COOLDOWN_MS = 1000;

/**
 * Base exponential backoff duration in milliseconds applied upon the first failure.
 */
export const BASE_BACKOFF_MS = 5000;

/**
 * Maximum upper bound in milliseconds for exponential backoff delays.
 */
export const MAX_BACKOFF_MS = 120000;

const mirrorStates = new Map<string, MirrorHealthState>();
let lastGlobalRequestTime = 0;

/**
 * Returns the timestamp of the most recent mirror network dispatch.
 *
 * @returns Timestamp in milliseconds.
 */
export function getLastGlobalRequestTime(): number {
  return lastGlobalRequestTime;
}

function getOrCreateMirrorState(url: string): MirrorHealthState {
  let state = mirrorStates.get(url);
  if (!state) {
    state = {
      url,
      consecutiveFailures: 0,
      backoffUntil: 0,
      lastRequestTime: 0,
      lastSuccessTime: 0,
    };
    mirrorStates.set(url, state);
  }
  return state;
}

/**
 * Returns a cloned snapshot array of current health metrics for all configured Overpass mirrors.
 *
 * @returns Array of cloned mirror health states.
 */
export function getMirrorHealthSnapshot(): MirrorHealthState[] {
  return API_CONFIG.OVERPASS_MIRRORS.map((url) => {
    const state = getOrCreateMirrorState(url);
    return { ...state };
  });
}

/**
 * Resets runtime mirror health states and global request timing for unit test isolation.
 */
export function resetMirrorStateForTesting(): void {
  mirrorStates.clear();
  lastGlobalRequestTime = 0;
}

function recordMirrorFailure(state: MirrorHealthState, retryAfterMs = 0): void {
  state.consecutiveFailures++;
  const expBackoff = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * Math.pow(2, state.consecutiveFailures - 1),
  );
  state.backoffUntil = Date.now() + Math.max(expBackoff, retryAfterMs);
}

/**
 * Computes an ordered candidate list of Overpass mirrors based on health state, backoff, and success history.
 *
 * @param now Current timestamp in milliseconds, defaulting to Date.now().
 * @returns Ordered array of candidate mirror health states.
 */
export function getCandidateMirrors(now: number = Date.now()): MirrorHealthState[] {
  const originalOrder = new Map<string, number>(
    API_CONFIG.OVERPASS_MIRRORS.map((url, index) => [url, index]),
  );

  const available: MirrorHealthState[] = [];
  const backedOff: MirrorHealthState[] = [];

  for (const url of API_CONFIG.OVERPASS_MIRRORS) {
    const state = getOrCreateMirrorState(url);
    if (now >= state.backoffUntil) {
      available.push(state);
    } else {
      backedOff.push(state);
    }
  }

  available.sort((a, b) => {
    if (a.consecutiveFailures !== b.consecutiveFailures) {
      return a.consecutiveFailures - b.consecutiveFailures;
    }
    if (b.lastSuccessTime !== a.lastSuccessTime) {
      return b.lastSuccessTime - a.lastSuccessTime;
    }
    return (originalOrder.get(a.url) ?? 0) - (originalOrder.get(b.url) ?? 0);
  });

  backedOff.sort((a, b) => {
    if (a.backoffUntil !== b.backoffUntil) {
      return a.backoffUntil - b.backoffUntil;
    }
    return (originalOrder.get(a.url) ?? 0) - (originalOrder.get(b.url) ?? 0);
  });

  return [...available, ...backedOff];
}

/**
 * Helper to fetch Overpass query data by iterating over ordered candidate mirrors with backoff and rate limits.
 */
async function fetchFromMirrors(query: string): Promise<unknown> {
  const candidates = getCandidateMirrors();
  let lastError: Error | null = null;

  for (const state of candidates) {
    let failureRecorded = false;
    try {
      const now = Date.now();
      if (now < state.backoffUntil) {
        const remainingBackoff = state.backoffUntil - now;
        if (remainingBackoff <= 2000) {
          await new Promise((resolve) => setTimeout(resolve, remainingBackoff));
        }
      }

      const timeSinceLast = Date.now() - state.lastRequestTime;
      if (timeSinceLast < INTER_REQUEST_COOLDOWN_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, INTER_REQUEST_COOLDOWN_MS - timeSinceLast),
        );
      }

      state.lastRequestTime = Date.now();
      lastGlobalRequestTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(
          new Error(
            `Request to mirror ${state.url} timed out after ${API_CONFIG.MIRROR_REQUEST_TIMEOUT_MS}ms`,
          ),
        );
      }, API_CONFIG.MIRROR_REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(state.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'data=' + encodeURIComponent(query),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.status === 429) {
        const retryAfter = response.headers?.get('Retry-After');
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 0;
        recordMirrorFailure(state, retryAfterMs);
        failureRecorded = true;
        throw new Error(`Mirror ${state.url} returned HTTP 429 Too Many Requests (Rate Limited).`);
      }

      if (!response.ok) {
        recordMirrorFailure(state);
        failureRecorded = true;
        throw new Error(`Mirror ${state.url} returned error status: ${response.status}`);
      }

      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(
          `Mirror ${state.url} returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          { cause: parseErr },
        );
      }

      if (
        parsed &&
        typeof parsed === 'object' &&
        'remark' in parsed &&
        typeof (parsed as { remark: unknown }).remark === 'string' &&
        /error|timed out|timeout|memory|busy/i.test((parsed as { remark: string }).remark) &&
        (!('elements' in parsed) ||
          !Array.isArray((parsed as { elements: unknown }).elements) ||
          (parsed as { elements: unknown[] }).elements.length === 0)
      ) {
        throw new Error(
          `Mirror ${state.url} returned Overpass runtime error: ${(parsed as { remark: string }).remark}`,
        );
      }

      try {
        const bytes = new TextEncoder().encode(text).byteLength;
        addDataUsage(bytes, false);
      } catch (e) {
        logger.warn('Failed to calculate downloaded response size:', e);
      }

      state.consecutiveFailures = 0;
      state.backoffUntil = 0;
      state.lastSuccessTime = Date.now();
      return parsed;
    } catch (err: unknown) {
      if (!failureRecorded) {
        recordMirrorFailure(state);
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`Failed to fetch from ${state.url}:`, errorMsg);
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
 *
 * @param query Overpass QL query string.
 * @returns Parsed JSON response payload from Overpass or cache.
 */
export async function fetchWithCacheAndFallback(query: string): Promise<unknown> {
  const match = query.match(
    /\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/,
  );
  const bboxParam = match ? `&bbox=${match[1]},${match[2]},${match[3]},${match[4]}` : '';
  const cacheKeyUrl = `https://overpass-interpreter-cache/?query=${encodeURIComponent(query)}${bboxParam}`;
  return fetchWithCache(cacheKeyUrl, () => fetchFromMirrors(query));
}
