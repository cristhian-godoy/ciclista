import { describe, expect, it } from 'vitest';

import { ensureWasmInitialized, WasmEngine, WasmStreetGraph } from './index';

describe('WasmStreetGraph memory retention and lifecycle', () => {
  it('instantiates and retains WasmStreetGraph in WASM linear memory across queries', async () => {
    const initialized = await ensureWasmInitialized();
    if (!initialized) {
      // In environments where WASM binary fetching is not emulated in Node, skip gracefully
      return;
    }

    const wasmGraph = new WasmStreetGraph();
    expect(wasmGraph.node_count).toBe(0);

    const mock = WasmEngine.load_mock_graph();
    expect(mock.node_count).toBeGreaterThan(0);

    // Merge mock graph into wasmGraph
    wasmGraph.merge_with(mock);
    const countAfterMerge = wasmGraph.node_count;
    expect(countAfterMerge).toBe(mock.node_count);

    // Execute queries against retained wasmGraph across multiple invocations
    const start = { lat: 48.13715, lng: 11.5754 };
    const end = { lat: 48.135, lng: 11.582 };

    const variants1 = wasmGraph.find_route_variants(start, end, null, 'astar');
    expect(Array.isArray(variants1)).toBe(true);
    expect(variants1.length).toBeGreaterThan(0);

    // Query 2 without rebuilding graph:
    const variants2 = wasmGraph.find_route_variants(start, end, null, 'astar');
    expect(Array.isArray(variants2)).toBe(true);
    expect(variants2.length).toBe(variants1.length);

    // Incrementally merge additional nodes/edges
    const chunkJson = JSON.stringify({
      nodes: [
        [
          'extra-node',
          {
            node: { id: 'extra-node', lat: 48.14, lng: 11.58, tags: {} },
            edges: [],
          },
        ],
      ],
    });
    wasmGraph.merge_from_js_graph(JSON.parse(chunkJson));
    expect(wasmGraph.node_count).toBe(countAfterMerge + 1);

    // Clear
    wasmGraph.clear();
    expect(wasmGraph.node_count).toBe(0);
  });
});
