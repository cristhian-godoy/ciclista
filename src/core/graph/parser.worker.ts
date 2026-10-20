import { API_CONFIG } from '../common/constants';
import { logger } from '../common/logger';
import { ensureWasmInitialized, WasmEngine } from '../wasm';
import { OSMGraphParser } from './parser';

const parser = new OSMGraphParser();

self.onmessage = async (e: MessageEvent) => {
  const { requestId, rawData, cacheUrl } = e.data;

  try {
    let dataToParse = rawData;
    let byteLength = 0;

    if (cacheUrl) {
      const cacheInstance = await caches.open(API_CONFIG.CACHE_NAME);
      const cachedResponse = await cacheInstance.match(new Request(cacheUrl));
      if (!cachedResponse) {
        throw new Error(`No cached response found for cacheUrl: ${cacheUrl}`);
      }

      const contentLengthHeader = cachedResponse.headers.get('Content-Length');
      if (contentLengthHeader) {
        byteLength = parseInt(contentLengthHeader, 10);
      }

      const text = await cachedResponse.text();
      if (!byteLength) {
        byteLength = text.length;
      }
      dataToParse = JSON.parse(text);
    }

    const wasmReady = await ensureWasmInitialized();
    if (wasmReady) {
      try {
        const wasmGraph = WasmEngine.parse_graph(dataToParse);
        const serializedNodes = wasmGraph.to_entries_json();
        self.postMessage({ requestId, serializedNodes, byteLength });
        return;
      } catch (error) {
        logger.warn('WASM graph parsing failed, falling back to TypeScript parser:', error);
      }
    }

    const graph = parser.parse(dataToParse);
    const nodesEntries = Array.from(graph.nodes.entries());
    const serializedNodes = JSON.stringify(nodesEntries);
    self.postMessage({ requestId, serializedNodes, byteLength });
  } catch (error) {
    self.postMessage({ requestId, error: String(error) });
  }
};
