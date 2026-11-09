import { API_CONFIG } from '../common/constants';
import { coordToChunkId, getChunksInBBox } from '../common/geo';
import { logger } from '../common/logger';
import type { NodeEntry, StreetGraph } from '../graph/types';
import { getValidCacheEntries } from './cache';
import { chunkRegistry } from './chunkRegistry';
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
  chunkRegistry.updateChunkGraphStats(chunkId, chunkGraph, 'cached');

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
    chunkRegistry.updateChunkGraphStats(chunkId, memCached, 'cached');
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
    chunkRegistry.updateChunkGraphStats(chunkId, graph, 'cached');
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
 * Returns an array of chunk identifiers currently cached in memory.
 *
 * @returns Array of chunk IDs in memory.
 */
export function getInMemoryChunkIds(): string[] {
  return Array.from(inMemoryChunkCache.keys());
}

/**
 * Returns the parsed StreetGraph for a given chunk ID if held in memory.
 *
 * @param chunkId - Chunk identifier in format 'latIdx,lngIdx'.
 * @returns Parsed StreetGraph or undefined if not cached in memory.
 */
export function getInMemoryChunkGraph(chunkId: string): StreetGraph | undefined {
  return inMemoryChunkCache.get(chunkId);
}

/**
 * Retrieves all unique chunk IDs present in in-memory cache and persistent CacheStorage.
 *
 * @returns Deduplicated array of chunk identifiers.
 */
export async function getAllCachedChunkIds(): Promise<string[]> {
  const ids = new Set<string>(inMemoryChunkCache.keys());
  const cache = await getChunkCacheStorage();
  if (cache && typeof cache.keys === 'function') {
    try {
      const keys = await cache.keys();
      const prefix = 'https://ciclista-chunk-cache/chunk/';
      for (const req of keys) {
        if (req.url.startsWith(prefix)) {
          ids.add(req.url.slice(prefix.length));
        }
      }
    } catch (err) {
      logger.warn('Failed to retrieve keys from chunk CacheStorage:', err);
    }
  }
  return Array.from(ids);
}

/**
 * Evicts a single parsed chunk from both in-memory cache and persistent CacheStorage.
 *
 * @param chunkId - Chunk identifier to evict.
 */
export async function evictParsedChunk(chunkId: string): Promise<void> {
  inMemoryChunkCache.delete(chunkId);
  chunkRegistry.setChunkState(chunkId, 'uncached', { nodeCount: 0, edgeCount: 0 });
  const cache = await getChunkCacheStorage();
  if (cache && typeof cache.delete === 'function') {
    try {
      await cache.delete(new Request(getChunkUrl(chunkId)));
    } catch (err) {
      logger.warn(`Failed to evict parsed chunk ${chunkId} from CacheStorage:`, err);
    }
  }
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
  const allowedChunks = chunkIds && chunkIds.length > 0 ? new Set(chunkIds) : null;

  if (allowedChunks) {
    for (const id of allowedChunks) {
      partitioned.set(id, new Map());
    }
  }

  for (const [nodeId, entry] of graph.nodes.entries()) {
    const cId = coordToChunkId(entry.node.lat, entry.node.lng);
    if (allowedChunks && !allowedChunks.has(cId)) {
      continue;
    }
    let chunkNodes = partitioned.get(cId);
    if (!chunkNodes) {
      chunkNodes = new Map();
      partitioned.set(cId, chunkNodes);
    }
    chunkNodes.set(nodeId, entry);
  }

  for (const [, chunkNodes] of partitioned.entries()) {
    const stubsToAdd = new Map<string, NodeEntry>();
    for (const entry of chunkNodes.values()) {
      for (const edge of entry.edges) {
        if (!chunkNodes.has(edge.target) && !stubsToAdd.has(edge.target)) {
          const targetEntry = graph.nodes.get(edge.target);
          if (targetEntry) {
            stubsToAdd.set(edge.target, { node: targetEntry.node, edges: [] });
          }
        }
      }
    }
    for (const [stubId, stubEntry] of stubsToAdd.entries()) {
      chunkNodes.set(stubId, stubEntry);
    }
  }

  const savePromises: Promise<void>[] = [];
  for (const [cId, chunkNodes] of partitioned.entries()) {
    savePromises.push(saveParsedChunk(cId, { nodes: chunkNodes }));
  }

  await Promise.all(savePromises);
}

/**
 * Synchronizes all cached chunk identifiers from persistent CacheStorage
 * and in-memory caches into the central chunkRegistry.
 *
 * @returns Array of unique cached chunk identifiers registered.
 */
export async function syncCachedChunksToRegistry(): Promise<string[]> {
  const parsedIds = await getAllCachedChunkIds();
  const rawEntries = await getValidCacheEntries();

  const idSet = new Set<string>(parsedIds);
  for (const entry of rawEntries) {
    const chunkIds = getChunksInBBox(entry.bbox);
    for (const id of chunkIds) {
      idSet.add(id);
    }
  }

  const allCachedIds = Array.from(idSet);
  chunkRegistry.registerCachedChunks(allCachedIds);

  for (const [chunkId, graph] of inMemoryChunkCache.entries()) {
    chunkRegistry.updateChunkGraphStats(chunkId, graph, 'cached');
  }

  return allCachedIds;
}

/**
 * Clears the in-memory parsed chunk cache and deletes the CacheStorage store.
 */
export async function clearChunkCache(): Promise<void> {
  inMemoryChunkCache.clear();
  chunkRegistry.reset();
  if (typeof caches !== 'undefined' && typeof caches.delete === 'function') {
    try {
      await caches.delete(CHUNK_CACHE_NAME);
    } catch (err) {
      logger.warn('Failed to delete chunk CacheStorage:', err);
    }
  }
}
