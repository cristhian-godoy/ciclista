import { OSMGraphParser } from './parser';
import type { StreetGraph } from './types';

let nextRequestId = 0;
const pendingRequests = new Map<
  number,
  {
    resolve: (graph: StreetGraph) => void;
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
        const { requestId, serializedNodes, error } = e.data;
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
          pending.resolve(graph);
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
    pendingRequests.set(requestId, { resolve, reject });
    try {
      workerInstance.postMessage({ requestId, rawData });
    } catch (err) {
      pendingRequests.delete(requestId);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
