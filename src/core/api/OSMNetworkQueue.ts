import { API_CONFIG, MAP_CONFIG } from '../common/constants';
import { mergeChunksToBBox } from '../common/geo';
import { logger } from '../common/logger';
import { OSMGraphParser } from '../graph/parser';
import type { OSMLoadResult } from './OSMLoader';
import { fetchWithCacheAndFallback } from './overpass';

const parser = new OSMGraphParser();

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
  private static statusListeners = new Set<QueueStatusListener>();
  private static dataListeners = new Set<QueueDataListener>();
  private static errorListeners = new Set<QueueErrorListener>();

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

  private static async processQueue() {
    if (this.pendingChunks.size === 0) {
      this.notifyStatus(false);
      return;
    }

    this.notifyStatus(true);

    const chunksToFetch = Array.from(this.pendingChunks);
    this.pendingChunks.clear();

    try {
      const groups = this.partitionChunks(chunksToFetch);
      logger.log(
        `Processing queue: divided ${chunksToFetch.length} chunks into ${groups.length} query groups.`,
      );

      for (const group of groups) {
        if (group.length === 0) continue;

        const mergedBBox = mergeChunksToBBox(group);
        logger.log(
          `Fetching group of ${group.length} chunks from Overpass API via merged bbox query:`,
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

        const data = await fetchWithCacheAndFallback(query);
        const parsed = parser.parse(data);

        this.notifyData({
          graph: parsed,
          loadedChunkIds: group,
        });
      }
    } catch (err) {
      logger.error('Failed to process network queue:', err);
      this.notifyError(err);
    } finally {
      this.processQueue();
    }
  }

  private static partitionChunks(chunkIds: string[]): string[][] {
    const groups: string[][] = [];
    const remaining = new Set(chunkIds);

    while (remaining.size > 0) {
      const currentGroup: string[] = [];
      for (const chunkId of remaining) {
        const testGroup = [...currentGroup, chunkId];
        const bbox = mergeChunksToBBox(testGroup);
        const latSpan = bbox[2] - bbox[0];
        const lngSpan = bbox[3] - bbox[1];
        if (latSpan <= MAP_CONFIG.MAX_LAT_SPAN && lngSpan <= MAP_CONFIG.MAX_LNG_SPAN) {
          currentGroup.push(chunkId);
          remaining.delete(chunkId);
        }
      }
      groups.push(currentGroup);
    }
    return groups;
  }
}
