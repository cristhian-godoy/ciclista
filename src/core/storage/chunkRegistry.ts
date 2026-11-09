import { coordToChunkId, getChunkBBox, getChunksInBBox } from '../common/geo';
import { logger } from '../common/logger';
import type { StreetGraph } from '../graph/types';

/**
 * State representing a chunk's progress through the lifecycle.
 */
export type ChunkLifecycleState =
  'uncached' | 'cached' | 'pending' | 'fetching' | 'loaded' | 'error';

/**
 * Metadata record for a single spatial chunk managed by the chunk registry.
 */
export interface ChunkRecord {
  /** Unique chunk identifier in format 'latIdx,lngIdx'. */
  chunkId: string;
  /** Spatial bounding box of the chunk [minLat, minLng, maxLat, maxLng]. */
  bbox: [number, number, number, number];
  /** Current lifecycle state of the chunk. */
  state: ChunkLifecycleState;
  /** Number of street graph nodes contained within the chunk boundaries. */
  nodeCount: number;
  /** Number of outbound street graph edges originating from nodes in this chunk. */
  edgeCount: number;
  /** Epoch timestamp in milliseconds of the last state or stats mutation. */
  updatedAt: number;
}

/**
 * Central state registry tracking spatial chunks, their bounding boxes,
 * lifecycle states, and graph statistics. Adheres to core domain isolation.
 */
export class ChunkRegistry {
  private records = new Map<string, ChunkRecord>();
  private listeners = new Set<() => void>();
  private currentViewport: [number, number, number, number] | null = null;
  private snapshot: ChunkRecord[] = [];

  /**
   * Subscribes a listener to registry updates.
   *
   * @param listener - Callback invoked whenever registry records mutate.
   * @returns Unsubscribe function to remove the listener.
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns referentially stable snapshot of all chunk records for useSyncExternalStore.
   *
   * @returns Array of all chunk records.
   */
  public getSnapshot(): ChunkRecord[] {
    return this.snapshot;
  }

  /**
   * Returns an array of all chunk records currently registered.
   *
   * @returns Array of all chunk records.
   */
  public getAllChunks(): ChunkRecord[] {
    return this.snapshot;
  }

  /**
   * Retrieves the record for a specific chunk ID if registered.
   *
   * @param chunkId - Chunk identifier in 'latIdx,lngIdx' format.
   * @returns The chunk record or undefined if not registered.
   */
  public getChunk(chunkId: string): ChunkRecord | undefined {
    return this.records.get(chunkId);
  }

  /**
   * Returns the currently registered viewport bounding box, if any.
   *
   * @returns Active viewport bbox or null.
   */
  public getViewport(): [number, number, number, number] | null {
    return this.currentViewport;
  }

  /**
   * Registers a viewport bounding box, discovering all chunks covered by it
   * and initializing any newly discovered chunks in the 'uncached' state.
   *
   * @param bbox - Viewport bounding box [minLat, minLng, maxLat, maxLng].
   * @returns Array of chunk IDs overlapping the viewport.
   */
  public registerViewport(bbox: [number, number, number, number]): string[] {
    this.currentViewport = bbox;
    const chunkIds = getChunksInBBox(bbox);
    let mutated = false;
    const now = Date.now();

    for (const id of chunkIds) {
      if (!this.records.has(id)) {
        this.records.set(id, {
          chunkId: id,
          bbox: getChunkBBox(id),
          state: 'uncached',
          nodeCount: 0,
          edgeCount: 0,
          updatedAt: now,
        });
        mutated = true;
      }
    }

    if (mutated) {
      this.updateSnapshotAndNotify();
    }

    return chunkIds;
  }

  /**
   * Registers known cached chunk IDs, inserting new 'cached' records
   * or upgrading existing 'uncached' records to 'cached'.
   *
   * @param chunkIds - Array of chunk IDs known to be stored in persistent or memory cache.
   */
  public registerCachedChunks(chunkIds: string[]): void {
    let mutated = false;
    const now = Date.now();

    for (const id of chunkIds) {
      const existing = this.records.get(id);
      if (!existing) {
        this.records.set(id, {
          chunkId: id,
          bbox: getChunkBBox(id),
          state: 'cached',
          nodeCount: 0,
          edgeCount: 0,
          updatedAt: now,
        });
        mutated = true;
      } else if (existing.state === 'uncached') {
        existing.state = 'cached';
        existing.updatedAt = now;
        mutated = true;
      }
    }

    if (mutated) {
      this.updateSnapshotAndNotify();
    }
  }

  /**
   * Updates or sets the lifecycle state and optional graph stats for one or multiple chunks.
   *
   * @param chunkIds - Single chunk ID or array of chunk IDs.
   * @param state - New lifecycle state to apply.
   * @param stats - Optional node count and edge count statistics.
   */
  public setChunkState(
    chunkIds: string | string[],
    state: ChunkLifecycleState,
    stats?: { nodeCount?: number; edgeCount?: number },
  ): void {
    const ids = Array.isArray(chunkIds) ? chunkIds : [chunkIds];
    if (ids.length === 0) return;

    const now = Date.now();
    for (const id of ids) {
      const existing = this.records.get(id);
      if (existing) {
        existing.state = state;
        if (stats?.nodeCount !== undefined) {
          existing.nodeCount = stats.nodeCount;
        }
        if (stats?.edgeCount !== undefined) {
          existing.edgeCount = stats.edgeCount;
        }
        existing.updatedAt = now;
      } else {
        this.records.set(id, {
          chunkId: id,
          bbox: getChunkBBox(id),
          state,
          nodeCount: stats?.nodeCount ?? 0,
          edgeCount: stats?.edgeCount ?? 0,
          updatedAt: now,
        });
      }
    }

    this.updateSnapshotAndNotify();
  }

  /**
   * Updates graph node and edge counts for a chunk based on a parsed StreetGraph subset,
   * counting only nodes whose coordinates resolve directly to this chunkId.
   *
   * @param chunkId - Chunk identifier in format 'latIdx,lngIdx'.
   * @param chunkGraph - StreetGraph subset belonging to the chunk.
   * @param stateIfNewOrUncached - State to assign if record is newly created or previously uncached.
   */
  public updateChunkGraphStats(
    chunkId: string,
    chunkGraph: StreetGraph,
    stateIfNewOrUncached: ChunkLifecycleState = 'cached',
  ): void {
    let nodeCount = 0;
    let edgeCount = 0;

    for (const entry of chunkGraph.nodes.values()) {
      if (coordToChunkId(entry.node.lat, entry.node.lng) === chunkId) {
        nodeCount++;
        edgeCount += entry.edges.length;
      }
    }

    const now = Date.now();
    const existing = this.records.get(chunkId);
    if (existing) {
      existing.nodeCount = nodeCount;
      existing.edgeCount = edgeCount;
      existing.updatedAt = now;
      if (existing.state === 'uncached') {
        existing.state = stateIfNewOrUncached;
      }
    } else {
      this.records.set(chunkId, {
        chunkId,
        bbox: getChunkBBox(chunkId),
        state: stateIfNewOrUncached,
        nodeCount,
        edgeCount,
        updatedAt: now,
      });
    }

    this.updateSnapshotAndNotify();
  }

  /**
   * Resets all registered chunks, clearing the viewport and records.
   */
  public reset(): void {
    this.records.clear();
    this.currentViewport = null;
    this.snapshot = [];
    this.notifyListeners();
  }

  private updateSnapshotAndNotify(): void {
    this.snapshot = Array.from(this.records.values());
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        logger.error('Error in ChunkRegistry listener:', err);
      }
    }
  }
}

/**
 * Singleton instance of ChunkRegistry for application-wide chunk lifecycle tracking.
 */
export const chunkRegistry = new ChunkRegistry();
