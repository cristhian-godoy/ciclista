import { API_CONFIG } from '../common/constants';
import { convertGraphToGeoJSON, type GraphGeoJSON } from './geojson';
import { OSMGraphParser } from './parser';
import type { StreetGraph } from './types';

interface WorkerCallbackPayload {
  graph?: StreetGraph;
  geoJson?: GraphGeoJSON;
  byteLength?: number;
}

let nextRequestId = 0;
const pendingRequests = new Map<
  number,
  {
    resolve: (res: WorkerCallbackPayload) => void;
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
        const { requestId, serializedNodes, geoJson, byteLength = 0, error } = e.data;
        const pending = pendingRequests.get(requestId);
        if (!pending) return;
        pendingRequests.delete(requestId);

        if (error) {
          pending.reject(new Error(error));
        } else if (serializedNodes) {
          const nodesEntries = JSON.parse(serializedNodes);
          const graph: StreetGraph = {
            nodes: new Map(nodesEntries),
          };
          pending.resolve({ graph, geoJson, byteLength });
        } else {
          pending.resolve({ geoJson, byteLength });
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
 * Offloads convertGraphToGeoJSON computation to the Web Worker so panning and large graphs
 * do not rebuild 100k+ LineString features synchronously on the main UI thread.
 *
 * @param graph - StreetGraph to convert.
 * @param customNodeDelays - Optional mapping of node IDs to custom signal delays.
 * @param showMinorControls - Whether to generate features for minor controls (yield, stop, pedestrian).
 * @returns GeoJSON features partitioned into streets and controls.
 */
export function convertGraphToGeoJSONInWorker(
  graph: StreetGraph,
  customNodeDelays?: Map<string, number>,
  showMinorControls?: boolean,
): Promise<GraphGeoJSON> {
  const workerInstance = getWorker();
  if (!workerInstance) {
    try {
      const geoJson = convertGraphToGeoJSON(
        graph,
        customNodeDelays || new Map(),
        showMinorControls ?? false,
      );
      return Promise.resolve(geoJson);
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return new Promise<GraphGeoJSON>((resolve, reject) => {
    const requestId = nextRequestId++;
    pendingRequests.set(requestId, {
      resolve: (res) => resolve(res.geoJson!),
      reject,
    });
    try {
      const graphEntries = Array.from(graph.nodes.entries());
      const customNodeDelaysEntries = customNodeDelays
        ? Array.from(customNodeDelays.entries())
        : [];
      workerInstance.postMessage({
        requestId,
        action: 'convertToGeoJSON',
        graphEntries,
        customNodeDelaysEntries,
        showMinorControls: showMinorControls ?? false,
      });
    } catch (err) {
      pendingRequests.delete(requestId);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
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
      resolve: (res) => resolve(res.graph!),
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
    pendingRequests.set(requestId, {
      resolve: (res) => resolve({ graph: res.graph!, byteLength: res.byteLength || 0 }),
      reject,
    });
    try {
      workerInstance.postMessage({ requestId, cacheUrl });
    } catch (err) {
      pendingRequests.delete(requestId);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
