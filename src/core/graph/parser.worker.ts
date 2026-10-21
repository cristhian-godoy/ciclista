import { API_CONFIG } from '../common/constants';
import { logger } from '../common/logger';
import { ensureWasmInitialized, WasmEngine } from '../wasm';
import { convertGraphToGeoJSON } from './geojson';
import { OSMGraphParser } from './parser';
import type { NodeEntry, StreetGraph } from './types';

const parser = new OSMGraphParser();

self.onmessage = async (e: MessageEvent) => {
  const { requestId, rawData, cacheUrl, action } = e.data;

  try {
    if (action === 'convertToGeoJSON') {
      const { graphEntries = [], customNodeDelaysEntries = [], showMinorControls = false } = e.data;
      const nodesMap = new Map<string, NodeEntry>(graphEntries);
      const delaysMap = new Map<string, number>(customNodeDelaysEntries);
      const geoJson = convertGraphToGeoJSON(
        { nodes: nodesMap },
        delaysMap,
        Boolean(showMinorControls),
      );
      self.postMessage({ requestId, geoJson });
      return;
    }

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
        const nodesEntries = JSON.parse(serializedNodes) as [string, NodeEntry][];
        const graph: StreetGraph = { nodes: new Map(nodesEntries) };
        const geoJson = convertGraphToGeoJSON(graph, new Map(), false);
        self.postMessage({ requestId, serializedNodes, geoJson, byteLength });
        return;
      } catch (error) {
        logger.warn('WASM graph parsing failed, falling back to TypeScript parser:', error);
      }
    }

    const graph = parser.parse(dataToParse);
    const nodesEntries = Array.from(graph.nodes.entries());
    const serializedNodes = JSON.stringify(nodesEntries);
    const geoJson = convertGraphToGeoJSON(graph, new Map(), false);
    self.postMessage({ requestId, serializedNodes, geoJson, byteLength });
  } catch (error) {
    self.postMessage({ requestId, error: String(error) });
  }
};
