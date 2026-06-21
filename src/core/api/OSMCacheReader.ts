import { API_CONFIG } from '../common/constants';
import { getChunkBBox } from '../common/geo';
import { logger } from '../common/logger';
import { parseInWorker } from '../graph/parser.client';
import type { StreetGraph } from '../graph/types';
import { mergeGraphs } from '../graph/utils';
import { getValidCacheEntries } from '../storage/cache';
import { addDataUsage } from '../storage/dataUsage';

/**
 * Represents the result of attempting to load chunks from local cache.
 */
export interface CacheResolutionResult {
  graph: StreetGraph | null;
  loadedChunkIds: string[];
  missingChunkIds: string[];
}

/**
 * Service to check and load chunk data directly from browser CacheStorage,
 * separating cache resolution from network fetching.
 */
export class OSMCacheReader {
  /**
   * Helper to check if child bbox is fully contained in parent bbox.
   */
  private static isBBoxContained(
    child: [number, number, number, number],
    parent: [number, number, number, number],
  ): boolean {
    return (
      child[0] >= parent[0] - 0.000001 &&
      child[1] >= parent[1] - 0.000001 &&
      child[2] <= parent[2] + 0.000001 &&
      child[3] <= parent[3] + 0.000001
    );
  }

  /**
   * Resolves which chunks are cached and loads them from CacheStorage.
   */
  public static async readChunks(chunkIds: string[]): Promise<CacheResolutionResult> {
    if (chunkIds.length === 0) {
      return { graph: null, loadedChunkIds: [], missingChunkIds: [] };
    }

    const validCache = await getValidCacheEntries();
    const cachedChunkIds: string[] = [];
    const missingChunkIds: string[] = [];

    for (const chunkId of chunkIds) {
      const chunkBBox = getChunkBBox(chunkId);
      const isCached = validCache.some((entry) => this.isBBoxContained(chunkBBox, entry.bbox));
      if (isCached) {
        cachedChunkIds.push(chunkId);
      } else {
        missingChunkIds.push(chunkId);
      }
    }

    let mergedGraph: StreetGraph | null = null;
    const loadedChunkIds: string[] = [];

    if (cachedChunkIds.length > 0) {
      logger.log(`Loading ${cachedChunkIds.length} chunks directly from local CacheStorage.`);
      const cacheInstance = await caches.open(API_CONFIG.CACHE_NAME);

      const urlToChunkIds = new Map<string, string[]>();
      for (const chunkId of cachedChunkIds) {
        const chunkBBox = getChunkBBox(chunkId);
        const entry = validCache.find((e) => this.isBBoxContained(chunkBBox, e.bbox));
        if (entry) {
          const list = urlToChunkIds.get(entry.url) || [];
          list.push(chunkId);
          urlToChunkIds.set(entry.url, list);
        } else {
          missingChunkIds.push(chunkId);
        }
      }

      for (const [url, chunkIds] of urlToChunkIds.entries()) {
        try {
          const cachedResponse = await cacheInstance.match(new Request(url));
          if (cachedResponse) {
            const text = await cachedResponse.text();
            try {
              const size = new Blob([text]).size;
              addDataUsage(size, true);
            } catch (e) {
              logger.warn(`Failed to estimate cached data size for URL ${url}:`, e);
            }
            const data = JSON.parse(text);
            const parsed = await parseInWorker(data);
            mergedGraph = mergedGraph ? mergeGraphs(mergedGraph, parsed) : parsed;
            loadedChunkIds.push(...chunkIds);

            // Yield the main thread to allow MapLibre to render vector tiles and prevent stuttering
            await new Promise((resolve) => setTimeout(resolve, 0));
          } else {
            logger.warn(`No cached response found for URL ${url}`);
            missingChunkIds.push(...chunkIds);
          }
        } catch (err) {
          logger.warn(`Failed to read cached response for URL ${url}:`, err);
          missingChunkIds.push(...chunkIds);
        }
      }
    }

    return {
      graph: mergedGraph,
      loadedChunkIds,
      missingChunkIds,
    };
  }
}
