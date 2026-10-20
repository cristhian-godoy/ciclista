import { API_CONFIG } from '../common/constants';
import { OSMGraphParser } from './parser';
import type { StreetGraph } from './types';

let nextRequestId = 0;
const pendingRequests = new Map<
  number,
  {
    resolve: (res: { graph: StreetGraph; byteLength: number }) => void;
    reject: (err: Error) => void;
  }
>();

let worker: Worker | null = null;
const parser = new OSMGraphParser();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') {
    return null;
  }
  if (!worker) {
    try {
      worker = new Worker(new URL('./parser.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e) => {
        const { requestId, serializedNodes, byteLength = 0, error } = e.data;
        const pending = pendingRequests.get(requestId);
        if (!pending) return;
        pendingRequests.delete(requestId);

        if (error) {
          pending.reject(new Error(error));
        } else {
          const nodesEntries = JSON.parse(serializedNodes);
          const graph: StreetGraph = {
            nodes: new Map(nodesEntries),
          };
          pending.resolve({ graph, byteLength });
        }
      };
      worker.onerror = (err) => {
        console.error('Graph parser worker error:', err);
      };
    } catch (err) {
      console.warn('Failed to initialize Web Worker, falling back to main-thread parsing:', err);
      worker = null;
    }
  }
  return worker;
}

/**
 * Parses raw OSM data. Prefers doing so in a Web Worker,
 * but falls back to main-thread parsing if Workers are unavailable.
 */
export function parseInWorker(rawData: unknown): Promise<StreetGraph> {
  const workerInstance = getWorker();
  if (!workerInstance) {
    try {
      const graph = parser.parse(rawData);
      return Promise.resolve(graph);
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return new Promise<StreetGraph>((resolve, reject) => {
    const requestId = nextRequestId++;
    pendingRequests.set(requestId, {
      resolve: (res) => resolve(res.graph),
      reject,
    });
    try {
      workerInstance.postMessage({ requestId, rawData });
    } catch (err) {
      pendingRequests.delete(requestId);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Parses OSM data directly from CacheStorage by cache URL in a Web Worker,
 * avoiding main-thread JSON parsing and text reading.
 */
export async function parseFromCacheInWorker(
  cacheUrl: string,
): Promise<{ graph: StreetGraph; byteLength: number }> {
  const workerInstance = getWorker();
  if (!workerInstance) {
    const cacheInstance = await caches.open(API_CONFIG.CACHE_NAME);
    const cachedResponse = await cacheInstance.match(new Request(cacheUrl));
    if (!cachedResponse) {
      throw new Error(`No cached response found for cacheUrl: ${cacheUrl}`);
    }

    const contentLength = cachedResponse.headers?.get('Content-Length');
    const text = await cachedResponse.text();
    const byteLength = contentLength ? parseInt(contentLength, 10) : text.length;
    const rawData = JSON.parse(text);
    const graph = parser.parse(rawData);
    return { graph, byteLength };
  }

  return new Promise<{ graph: StreetGraph; byteLength: number }>((resolve, reject) => {
    const requestId = nextRequestId++;
    pendingRequests.set(requestId, { resolve, reject });
    try {
      workerInstance.postMessage({ requestId, cacheUrl });
    } catch (err) {
      pendingRequests.delete(requestId);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
