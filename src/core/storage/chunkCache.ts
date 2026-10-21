import { API_CONFIG } from '../common/constants';
import { coordToChunkId } from '../common/geo';
import { logger } from '../common/logger';
import type { NodeEntry, StreetGraph } from '../graph/types';
import { isDataSaverActive } from './dataUsage';

export const CHUNK_CACHE_NAME = 'ciclista-parsed-chunks-v1';

/**
 * In-memory map of parsed StreetGraph chunks keyed by chunkId (e.g. '4813,1158').
 */
const inMemoryChunkCache = new Map<string, StreetGraph>();

/**
 * Returns a Cache instance for parsed chunk storage if available in current environment.
 */
async function getChunkCacheStorage(): Promise<Cache | null> {
  if (typeof caches === 'undefined' || typeof caches.open !== 'function') {
    return null;
  }
  try {
    const cache = await caches.open(CHUNK_CACHE_NAME);
    if (!cache || typeof cache.match !== 'function') {
      return null;
    }
    return cache;
  } catch (err) {
    logger.warn('Failed to open chunk CacheStorage:', err);
    return null;
  }
}

/**
 * Constructs the canonical cache request URL for a given chunk identifier.
 */
function getChunkUrl(chunkId: string): string {
  return `https://ciclista-chunk-cache/chunk/${chunkId}`;
}

/**
 * Saves a parsed StreetGraph chunk into in-memory and persistent CacheStorage keyed by chunkId.
 *
 * @param chunkId - Chunk identifier in format 'latIdx,lngIdx'.
 * @param chunkGraph - Parsed StreetGraph subset belonging to the chunk.
 */
export async function saveParsedChunk(chunkId: string, chunkGraph: StreetGraph): Promise<void> {
  inMemoryChunkCache.set(chunkId, chunkGraph);

  const cache = await getChunkCacheStorage();
  if (!cache || typeof cache.put !== 'function') return;

  try {
    const entries = Array.from(chunkGraph.nodes.entries());
    const payload = JSON.stringify(entries);
    const response = new Response(payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache-Timestamp': Date.now().toString(),
      },
    });
    await cache.put(new Request(getChunkUrl(chunkId)), response);
  } catch (err) {
    logger.warn(`Failed to persist parsed chunk ${chunkId} to CacheStorage:`, err);
  }
}

/**
 * Loads an already-parsed StreetGraph chunk from memory or CacheStorage.
 *
 * @param chunkId - Chunk identifier to retrieve.
 * @returns Parsed StreetGraph or null if not cached or expired.
 */
export async function loadParsedChunk(chunkId: string): Promise<StreetGraph | null> {
  const memCached = inMemoryChunkCache.get(chunkId);
  if (memCached) {
    return memCached;
  }

  const cache = await getChunkCacheStorage();
  if (!cache) return null;

  try {
    const res = await cache.match(new Request(getChunkUrl(chunkId)));
    if (!res) return null;

    const timestampStr = res.headers.get('X-Cache-Timestamp');
    const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;
    const ttl = API_CONFIG.CACHE_TTL_MS;
    const now = Date.now();

    if (now - timestamp >= ttl && !isDataSaverActive()) {
      return null;
    }

    const text = await res.text();
    const entries = JSON.parse(text) as [string, NodeEntry][];
    const graph: StreetGraph = {
      nodes: new Map(entries),
    };

    inMemoryChunkCache.set(chunkId, graph);
    return graph;
  } catch (err) {
    logger.warn(`Failed to load cached parsed chunk ${chunkId}:`, err);
    return null;
  }
}

/**
 * Checks whether a given chunkId is available in the in-memory cache.
 *
 * @param chunkId - Chunk identifier to check.
 * @returns True if already loaded in memory.
 */
export function hasParsedChunkInMemory(chunkId: string): boolean {
  return inMemoryChunkCache.has(chunkId);
}

/**
 * Partitions a StreetGraph into per-chunk graphs and stores each into chunk cache.
 *
 * @param graph - Full or merged StreetGraph.
 * @param chunkIds - Optional array of chunk IDs covered by this graph payload.
 */
export async function saveParsedGraphByChunks(
  graph: StreetGraph,
  chunkIds?: string[],
): Promise<void> {
  const partitioned = new Map<string, Map<string, NodeEntry>>();

  if (chunkIds) {
    for (const id of chunkIds) {
      partitioned.set(id, new Map());
    }
  }

  for (const [nodeId, entry] of graph.nodes.entries()) {
    const cId = coordToChunkId(entry.node.lat, entry.node.lng);
    let chunkNodes = partitioned.get(cId);
    if (!chunkNodes) {
      chunkNodes = new Map();
      partitioned.set(cId, chunkNodes);
    }
    chunkNodes.set(nodeId, entry);
  }

  const savePromises: Promise<void>[] = [];
  for (const [cId, chunkNodes] of partitioned.entries()) {
    savePromises.push(saveParsedChunk(cId, { nodes: chunkNodes }));
  }

  await Promise.all(savePromises);
}

/**
 * Clears the in-memory parsed chunk cache and deletes the CacheStorage store.
 */
export async function clearChunkCache(): Promise<void> {
  inMemoryChunkCache.clear();
  if (typeof caches !== 'undefined' && typeof caches.delete === 'function') {
    try {
      await caches.delete(CHUNK_CACHE_NAME);
    } catch (err) {
      logger.warn('Failed to delete chunk CacheStorage:', err);
    }
  }
}
