import { API_CONFIG } from '../common/constants';
import { getChunkBBox, getChunksInBBox, mergeChunksToBBox } from '../common/geo';
import { logger } from '../common/logger';
import { OSMGraphParser } from '../graph/parser';
import type { StreetGraph } from '../graph/types';
import { mergeGraphs } from '../graph/utils';
import { getValidCacheEntries } from '../storage/cache';
import { addDataUsage } from '../storage/dataUsage';
import { fetchWithCacheAndFallback } from './overpass';

const parser = new OSMGraphParser();

/**
 * Represents the result of a successful OSM loading operation.
 */
export interface OSMLoadResult {
  graph: StreetGraph;
  loadedChunkIds: string[];
}

/**
 * Service to orchestrate chunk-based OSM loading, cache cross-referencing,
 * and concurrent-safe network fetching.
 */
export class OSMLoader {
  private static activeFetchPromise: Promise<void> | null = null;

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
   * Loads OSM data for a given viewport bounding box by resolving chunks,
   * fetching from cache, or making a single merged network request.
   */
  public static async loadViewport(
    viewportBBox: [number, number, number, number],
    alreadyLoadedChunks: Set<string>,
  ): Promise<OSMLoadResult | null> {
    const requiredChunks = getChunksInBBox(viewportBBox);
    if (requiredChunks.length === 0) {
      return null;
    }

    const neededChunks = requiredChunks.filter((chunkId) => !alreadyLoadedChunks.has(chunkId));
    if (neededChunks.length === 0) {
      return null;
    }

    logger.log(
      `Resolving ${neededChunks.length} needed chunks out of ${requiredChunks.length} required.`,
    );

    const validCache = await getValidCacheEntries();
    const cachedChunkIds: string[] = [];
    const networkChunkIds: string[] = [];

    for (const chunkId of neededChunks) {
      const chunkBBox = getChunkBBox(chunkId);
      const isCached = validCache.some((entry) => this.isBBoxContained(chunkBBox, entry.bbox));
      if (isCached) {
        cachedChunkIds.push(chunkId);
      } else {
        networkChunkIds.push(chunkId);
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
          networkChunkIds.push(chunkId);
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
            const parsed = parser.parse(data);
            mergedGraph = mergedGraph ? mergeGraphs(mergedGraph, parsed) : parsed;
            loadedChunkIds.push(...chunkIds);
          } else {
            logger.warn(`No cached response found for URL ${url}`);
            networkChunkIds.push(...chunkIds);
          }
        } catch (err) {
          logger.warn(`Failed to read cached response for URL ${url}:`, err);
          networkChunkIds.push(...chunkIds);
        }
      }
    }

    if (networkChunkIds.length > 0) {
      const mergedBBox = mergeChunksToBBox(networkChunkIds);
      logger.log(
        `Fetching ${networkChunkIds.length} chunks from Overpass API via merged bbox query:`,
        mergedBBox,
      );

      const query = `/* Application: Ciclista Commuter Analyzer - Contact: https://github.com/cristhian-godoy/ciclista */
[out:json][timeout:${API_CONFIG.QUERY_TIMEOUT_SECONDS}];
way["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|proposed|construction|abandoned|steps"]
   ["access"!~"no|private"]
   (${mergedBBox[0]},${mergedBBox[1]},${mergedBBox[2]},${mergedBBox[3]})->.ways;
(.ways;);
out geom;
(
  node(w.ways)["highway"~"traffic_signals|stop|give_way|crossing"];
  node(w.ways)["crossing"];
  node(w.ways)["barrier"~"bollard|cycle_barrier|gate|block|kerb"];
  node(w.ways)["railway"~"tram_crossing|tram_level_crossing"];
);
out body;`;

      let releaseLock: () => void = () => {};
      const myLockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });

      const previousPromise = this.activeFetchPromise;
      this.activeFetchPromise = myLockPromise;

      try {
        if (previousPromise) {
          logger.log('Another Overpass request is active. Waiting in queue...');
          await previousPromise;
        }

        const data = await fetchWithCacheAndFallback(query);
        const parsed = parser.parse(data);
        mergedGraph = mergedGraph ? mergeGraphs(mergedGraph, parsed) : parsed;
        loadedChunkIds.push(...networkChunkIds);
      } catch (err) {
        logger.error('Failed to fetch merged chunks from network:', err);
        throw err;
      } finally {
        releaseLock();
        if (this.activeFetchPromise === myLockPromise) {
          this.activeFetchPromise = null;
        }
      }
    }

    if (!mergedGraph) {
      return null;
    }

    return {
      graph: mergedGraph,
      loadedChunkIds,
    };
  }
}
