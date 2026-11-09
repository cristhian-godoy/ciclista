import { API_CONFIG, MAP_CONFIG } from '../common/constants';
import { getChunkBBox, mergeChunksToBBox } from '../common/geo';
import { logger } from '../common/logger';
import { parseInWorker } from '../graph/parser.client';
import type { StreetGraph } from '../graph/types';
import { saveParsedGraphByChunks } from '../storage/chunkCache';
import { fetchWithCacheAndFallback } from './overpass';

/**
 * Represents the result of a successful OSM loading operation.
 */
export interface OSMLoadResult {
  graph: StreetGraph;
  loadedChunkIds: string[];
}

/**
 * Callback listener type for status updates.
 */
export type QueueStatusListener = (isFetching: boolean) => void;

/**
 * Callback listener type for network data updates.
 */
export type QueueDataListener = (result: OSMLoadResult) => void;

/**
 * Callback listener type for error updates.
 */
export type QueueErrorListener = (error: unknown) => void;

/**
 * Service managing an asynchronous request queue for fetching OSM chunks.
 * Enforces a single concurrent request limit and merges bounding boxes,
 * partitioning them if they exceed size thresholds.
 */
export class OSMNetworkQueue {
  private static pendingChunks = new Set<string>();
  private static isFetching = false;
  private static currentViewport: [number, number, number, number] | null = null;
  private static statusListeners = new Set<QueueStatusListener>();
  private static dataListeners = new Set<QueueDataListener>();
  private static errorListeners = new Set<QueueErrorListener>();

  /**
   * Updates the current active viewport for pruning pending chunks outside the active area.
   */
  public static setViewport(bbox: [number, number, number, number] | null) {
    this.currentViewport = bbox;
  }

  /**
   * Returns a copy of the chunk IDs currently queued for fetching.
   *
   * @returns Array of pending chunk identifiers.
   */
  public static getPendingChunkIds(): string[] {
    return Array.from(this.pendingChunks);
  }

  /**
   * Registers a listener for fetching status changes.
   */
  public static addStatusListener(listener: QueueStatusListener) {
    this.statusListeners.add(listener);
    listener(this.isFetching);
  }

  /**
   * Deregisters a status change listener.
   */
  public static removeStatusListener(listener: QueueStatusListener) {
    this.statusListeners.delete(listener);
  }

  /**
   * Registers a listener for network data retrieval events.
   */
  public static addDataListener(listener: QueueDataListener) {
    this.dataListeners.add(listener);
  }

  /**
   * Deregisters a data retrieval listener.
   */
  public static removeDataListener(listener: QueueDataListener) {
    this.dataListeners.delete(listener);
  }

  /**
   * Registers a listener for query failure events.
   */
  public static addErrorListener(listener: QueueErrorListener) {
    this.errorListeners.add(listener);
  }

  /**
   * Deregisters a query failure listener.
   */
  public static removeErrorListener(listener: QueueErrorListener) {
    this.errorListeners.delete(listener);
  }

  /**
   * Enqueues a list of missing chunk IDs for retrieval.
   */
  public static enqueue(chunkIds: string[]) {
    let addedNew = false;
    for (const id of chunkIds) {
      if (!this.pendingChunks.has(id)) {
        this.pendingChunks.add(id);
        addedNew = true;
      }
    }

    if (!addedNew) {
      return;
    }

    logger.log(`Enqueued ${chunkIds.length} chunks. Total pending: ${this.pendingChunks.size}`);

    if (!this.isFetching) {
      this.processQueue();
    }
  }

  private static notifyStatus(status: boolean) {
    this.isFetching = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (e) {
        logger.error('Error in status listener:', e);
      }
    }
  }

  private static notifyData(result: OSMLoadResult) {
    for (const listener of this.dataListeners) {
      try {
        listener(result);
      } catch (e) {
        logger.error('Error in data listener:', e);
      }
    }
  }

  private static notifyError(error: unknown) {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (e) {
        logger.error('Error in error listener:', e);
      }
    }
  }

  /**
   * Prunes pending chunks that lie completely outside the current viewport.
   */
  private static prunePendingChunks() {
    if (!this.currentViewport || this.pendingChunks.size === 0) {
      return;
    }

    const [vMinLat, vMinLng, vMaxLat, vMaxLng] = this.currentViewport;
    const toRemove: string[] = [];

    for (const chunkId of this.pendingChunks) {
      const [cMinLat, cMinLng, cMaxLat, cMaxLng] = getChunkBBox(chunkId);
      // Check intersection
      const intersects =
        cMinLat <= vMaxLat && cMaxLat >= vMinLat && cMinLng <= vMaxLng && cMaxLng >= vMinLng;

      if (!intersects) {
        toRemove.push(chunkId);
      }
    }

    for (const id of toRemove) {
      this.pendingChunks.delete(id);
    }

    if (toRemove.length > 0) {
      logger.log(`Pruned ${toRemove.length} chunks outside current viewport.`);
    }
  }

  private static async processQueue() {
    if (this.pendingChunks.size === 0) {
      this.notifyStatus(false);
      return;
    }

    this.notifyStatus(true);

    const clusters = this.clusterContiguousChunks(Array.from(this.pendingChunks));
    const currentCluster = clusters[0];
    if (!currentCluster || currentCluster.length === 0) {
      this.pendingChunks.clear();
      this.notifyStatus(false);
      return;
    }

    for (const id of currentCluster) {
      this.pendingChunks.delete(id);
    }

    try {
      const rectangles = this.coalesceAdjacentRectangles(currentCluster);
      logger.log(
        `Processing queue: coalesced cluster of ${currentCluster.length} chunks into ${rectangles.length} rectangles.`,
      );

      const wayFilters = rectangles
        .map(
          ([minLat, minLng, maxLat, maxLng]) =>
            `way["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|proposed|construction|abandoned|steps"]["access"!~"no|private"](${minLat},${minLng},${maxLat},${maxLng});`,
        )
        .join('\n');

      const query = `/* Application: Ciclista Commuter Analyzer - Contact: https://github.com/cristhian-godoy/ciclista */
[out:json][timeout:${API_CONFIG.QUERY_TIMEOUT_SECONDS}];
(
${wayFilters}
)->.ways;
(.ways;);
out geom;
(
  node(w.ways)["highway"~"traffic_signals|stop|give_way|crossing"];
  node(w.ways)["crossing"];
  node(w.ways)["barrier"~"bollard|cycle_barrier|gate|block|kerb"];
  node(w.ways)["railway"~"tram_crossing|tram_level_crossing"];
);
out body;`;

      const data = await fetchWithCacheAndFallback(query);
      const parsed = await parseInWorker(data);
      await saveParsedGraphByChunks(parsed, currentCluster);

      this.notifyData({
        graph: parsed,
        loadedChunkIds: currentCluster,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
    } catch (err) {
      logger.error('Failed to process network queue:', err);
      this.notifyError(err);
    } finally {
      this.prunePendingChunks();
      this.processQueue();
    }
  }

  /**
   * Clusters contiguous chunks (sharing orthogonal or diagonal edges) and restricts
   * cluster bounding box span within MAP_CONFIG limits.
   */
  public static clusterContiguousChunks(chunkIds: string[]): string[][] {
    const unvisited = new Set(chunkIds);
    const clusters: string[][] = [];

    const getCoord = (id: string): [number, number] => {
      const parts = id.split(',').map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0];
    };

    while (unvisited.size > 0) {
      const nextIter = unvisited.values().next();
      if (nextIter.done) break;
      const startId = nextIter.value;
      unvisited.delete(startId);

      const cluster: string[] = [startId];
      const queue: string[] = [startId];

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const [currLat, currLng] = getCoord(curr);

        for (let dLat = -1; dLat <= 1; dLat++) {
          for (let dLng = -1; dLng <= 1; dLng++) {
            if (dLat === 0 && dLng === 0) continue;
            const neighborId = `${currLat + dLat},${currLng + dLng}`;
            if (unvisited.has(neighborId)) {
              const testCluster = [...cluster, neighborId];
              const bbox = mergeChunksToBBox(testCluster);
              const latSpan = bbox[2] - bbox[0];
              const lngSpan = bbox[3] - bbox[1];
              if (latSpan <= MAP_CONFIG.MAX_LAT_SPAN && lngSpan <= MAP_CONFIG.MAX_LNG_SPAN) {
                unvisited.delete(neighborId);
                cluster.push(neighborId);
                queue.push(neighborId);
              }
            }
          }
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Coalesces a set of contiguous chunk IDs into minimal adjacent rectangles.
   */
  public static coalesceAdjacentRectangles(chunkIds: string[]): [number, number, number, number][] {
    const coords = new Set(chunkIds);
    const rectangles: [number, number, number, number][] = [];

    const parse = (id: string): [number, number] => {
      const parts = id.split(',').map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0];
    };

    while (coords.size > 0) {
      // Find top-left (minLat, minLng)
      let minLat = Infinity;
      let minLng = Infinity;

      for (const id of coords) {
        const [lat, lng] = parse(id);
        if (lat < minLat || (lat === minLat && lng < minLng)) {
          minLat = lat;
          minLng = lng;
        }
      }

      // Expand horizontally along lng
      let maxLng = minLng;
      while (coords.has(`${minLat},${maxLng + 1}`)) {
        maxLng++;
      }

      // Expand vertically along lat while the entire horizontal strip exists
      let maxLat = minLat;
      let canExpand = true;
      while (canExpand) {
        const nextLat = maxLat + 1;
        for (let lng = minLng; lng <= maxLng; lng++) {
          if (!coords.has(`${nextLat},${lng}`)) {
            canExpand = false;
            break;
          }
        }
        if (canExpand) {
          maxLat = nextLat;
        }
      }

      // Remove covered cells
      const coveredChunks: string[] = [];
      for (let lat = minLat; lat <= maxLat; lat++) {
        for (let lng = minLng; lng <= maxLng; lng++) {
          const id = `${lat},${lng}`;
          coords.delete(id);
          coveredChunks.push(id);
        }
      }

      rectangles.push(mergeChunksToBBox(coveredChunks));
    }

    return rectangles;
  }
}
