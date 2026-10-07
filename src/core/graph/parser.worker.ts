import { ensureWasmInitialized, WasmEngine } from '../wasm';
import { OSMGraphParser } from './parser';

const parser = new OSMGraphParser();

self.onmessage = async (e: MessageEvent) => {
  const { requestId, rawData } = e.data;

  try {
    const wasmReady = await ensureWasmInitialized();
    if (wasmReady) {
      try {
        const wasmGraph = WasmEngine.parse_graph(rawData);
        const serializedNodes = wasmGraph.to_entries_json();
        self.postMessage({ requestId, serializedNodes });
        return;
      } catch {
        // Fall back cleanly to TypeScript parser
      }
    }

    const graph = parser.parse(rawData);
    const nodesEntries = Array.from(graph.nodes.entries());
    const serializedNodes = JSON.stringify(nodesEntries);
    self.postMessage({ requestId, serializedNodes });
  } catch (error) {
    self.postMessage({ requestId, error: String(error) });
  }
};
