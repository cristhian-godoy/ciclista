import { API_CONFIG, MAP_CONFIG } from '../common/constants';
import { getChunkBBox, mergeChunksToBBox } from '../common/geo';
import { logger } from '../common/logger';
import { parseInWorker } from '../graph/parser.client';
import type { StreetGraph } from '../graph/types';
import { saveParsedGraphByChunks } from '../storage/chunkCache';
import { chunkRegistry } from '../storage/chunkRegistry';
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
  private static fetchingChunks = new Set<string>();
  private static priorityChunks = new Set<string>();
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
   * Returns a copy of the chunk IDs currently being fetched from the network.
   *
   * @returns Array of chunk identifiers currently in flight.
   */
  public static getFetchingChunkIds(): string[] {
    return Array.from(this.fetchingChunks);
  }

  /**
   * Resets queue state for testing.
   */
  public static resetForTesting(): void {
    this.pendingChunks.clear();
    this.fetchingChunks.clear();
    this.priorityChunks.clear();
    this.isFetching = false;
    this.currentViewport = null;
    this.statusListeners.clear();
    this.dataListeners.clear();
    this.errorListeners.clear();
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
   *
   * @param chunkIds - List of chunk identifiers to retrieve.
   * @param priority - Whether the chunks should be prioritized at the head of the queue.
   */
  public static enqueue(chunkIds: string[], priority = false) {
    let addedNew = false;
    for (const id of chunkIds) {
      if (priority) {
        this.priorityChunks.add(id);
      }
      if (!this.pendingChunks.has(id) && !this.fetchingChunks.has(id)) {
        this.pendingChunks.add(id);
        addedNew = true;
        chunkRegistry.setChunkState(id, 'pending');
      }
    }

    if (!addedNew && !priority) {
      return;
    }

    logger.log(
      `Enqueued ${chunkIds.length} chunks (priority: ${priority}). Total pending: ${this.pendingChunks.size}`,
    );

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
   * Chunks marked as priority are never pruned.
   */
  private static prunePendingChunks() {
    if (!this.currentViewport || this.pendingChunks.size === 0) {
      return;
    }

    const [vMinLat, vMinLng, vMaxLat, vMaxLng] = this.currentViewport;
    const toRemove: string[] = [];

    for (const chunkId of this.pendingChunks) {
      if (this.priorityChunks.has(chunkId)) {
        continue;
      }
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
      chunkRegistry.setChunkState(toRemove, 'uncached');
      logger.log(`Pruned ${toRemove.length} chunks outside current viewport.`);
    }
  }

  /**
   * Sorts pending chunk IDs by priority, then by viewport intersection,
   * breaking ties with distance to viewport center.
   */
  private static sortPendingChunks(chunkIds: string[]): string[] {
    if (chunkIds.length <= 1) {
      return [...chunkIds];
    }

    const vp = this.currentViewport;
    const vCenterLat = vp ? (vp[0] + vp[2]) / 2 : 0;
    const vCenterLng = vp ? (vp[1] + vp[3]) / 2 : 0;

    return [...chunkIds].sort((a, b) => {
      // 1. Priority chunks first
      const aPriority = this.priorityChunks.has(a);
      const bPriority = this.priorityChunks.has(b);
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;

      // 2. Viewport-based sorting
      if (vp) {
        const [aMinLat, aMinLng, aMaxLat, aMaxLng] = getChunkBBox(a);
        const [bMinLat, bMinLng, bMaxLat, bMaxLng] = getChunkBBox(b);

        const aIntersects =
          aMinLat <= vp[2] && aMaxLat >= vp[0] && aMinLng <= vp[3] && aMaxLng >= vp[1];
        const bIntersects =
          bMinLat <= vp[2] && bMaxLat >= vp[0] && bMinLng <= vp[3] && bMaxLng >= vp[1];

        if (aIntersects && !bIntersects) return -1;
        if (!aIntersects && bIntersects) return 1;

        // Closest to viewport center first
        const aCenterLat = (aMinLat + aMaxLat) / 2;
        const aCenterLng = (aMinLng + aMaxLng) / 2;
        const bCenterLat = (bMinLat + bMaxLat) / 2;
        const bCenterLng = (bMinLng + bMaxLng) / 2;

        const distA =
          (aCenterLat - vCenterLat) * (aCenterLat - vCenterLat) +
          (aCenterLng - vCenterLng) * (aCenterLng - vCenterLng);
        const distB =
          (bCenterLat - vCenterLat) * (bCenterLat - vCenterLat) +
          (bCenterLng - vCenterLng) * (bCenterLng - vCenterLng);

        return distA - distB;
      }

      return 0;
    });
  }

  private static async processQueue() {
    if (this.pendingChunks.size === 0) {
      this.notifyStatus(false);
      return;
    }

    this.notifyStatus(true);

    const sortedPending = this.sortPendingChunks(Array.from(this.pendingChunks));
    const clusters = this.clusterContiguousChunks(sortedPending);
    const currentCluster = clusters[0];
    if (!currentCluster || currentCluster.length === 0) {
      this.pendingChunks.clear();
      this.notifyStatus(false);
      return;
    }

    for (const id of currentCluster) {
      this.pendingChunks.delete(id);
      this.fetchingChunks.add(id);
    }
    chunkRegistry.setChunkState(currentCluster, 'fetching');

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

      for (const id of currentCluster) {
        this.fetchingChunks.delete(id);
        this.priorityChunks.delete(id);
      }
      chunkRegistry.setChunkState(currentCluster, 'loaded');

      this.notifyData({
        graph: parsed,
        loadedChunkIds: currentCluster,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
    } catch (err) {
      logger.error('Failed to process network queue:', err);
      for (const id of currentCluster) {
        this.fetchingChunks.delete(id);
        this.priorityChunks.delete(id);
      }
      chunkRegistry.setChunkState(currentCluster, 'error');
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
