import { API_CONFIG } from '../common/constants';
import { getChunksInBBox, mergeChunksToBBox } from '../common/geo';
import { logger } from '../common/logger';
import { OSMGraphParser } from '../graph/parser';
import type { StreetGraph } from '../graph/types';
import { mergeGraphs } from '../graph/utils';
import { OSMCacheReader } from './OSMCacheReader';
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

    const cacheResult = await OSMCacheReader.readChunks(neededChunks);
    let mergedGraph = cacheResult.graph;
    const loadedChunkIds = [...cacheResult.loadedChunkIds];
    const networkChunkIds = cacheResult.missingChunkIds;

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
