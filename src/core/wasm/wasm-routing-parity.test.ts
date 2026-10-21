import fs from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Coordinate } from '../common/types';
import type { LocalOverrides } from '../config';
import { OSMGraphParser } from '../graph/parser';
import { AStarRouter } from '../router/astar';
import { avoidBusyRoadsCost, avoidStoppingCost, standardCost } from '../router/strategies';
import type { StrategyRouteVariant } from '../router/types';
import { ensureWasmInitialized, WasmEngine, WasmStreetGraph } from './index';

describe('WASM & TypeScript Routing Parity Integration', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, 'pkg/ciclista_wasm_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    const initialized = await ensureWasmInitialized(wasmBytes);
    expect(initialized).toBe(true);
  });

  describe('WasmStreetGraph lifecycle & serialization', () => {
    it('creates an empty graph and verifies node count', () => {
      const graph = new WasmStreetGraph();
      expect(graph.node_count).toBe(0);
    });

    it('loads the built-in mock graph and serializes/deserializes to JSON', () => {
      const mockGraph = WasmEngine.load_mock_graph();
      expect(mockGraph.node_count).toBe(7);

      const json = mockGraph.to_json();
      expect(typeof json).toBe('string');
      expect(json).toContain('"nodes"');

      const restored = WasmStreetGraph.from_json(json);
      expect(restored.node_count).toBe(mockGraph.node_count);

      const entriesJson = mockGraph.to_entries_json();
      expect(typeof entriesJson).toBe('string');
      const entries = JSON.parse(entriesJson) as [string, unknown][];
      expect(entries).toHaveLength(7);
    });

    it('merges two WasmStreetGraph instances', () => {
      const g1 = new WasmStreetGraph();
      const mock = WasmEngine.load_mock_graph();
      g1.merge_with(mock);
      expect(g1.node_count).toBe(mock.node_count);
    });

    it('parses raw OSM JSON string with WasmEngine', () => {
      const rawOsm = JSON.stringify({
        elements: [
          { type: 'node', id: 101, lat: 48.13, lon: 11.57, tags: {} },
          { type: 'node', id: 102, lat: 48.14, lon: 11.58, tags: {} },
          { type: 'way', id: 201, nodes: [101, 102], tags: { highway: 'cycleway' } },
        ],
      });
      const parsed = WasmEngine.parse_graph_json(rawOsm);
      expect(parsed.node_count).toBe(2);
    });
  });

  describe('Routing algorithm parity: TypeScript vs WASM', () => {
    const startCoord: Coordinate = { lat: 48.137, lng: 11.575 };
    const endCoord: Coordinate = { lat: 48.14, lng: 11.58 };
    const overrides: LocalOverrides = {
      nodeDelays: new Map(),
      nodeNotes: new Map(),
      nodeTurns: new Map(),
    };

    it('produces matching route variants between TypeScript and WASM for the mock graph', () => {
      const wasmGraph = WasmEngine.load_mock_graph();

      // 1. WASM route variants
      const wasmVariants = WasmEngine.find_route_variants(
        wasmGraph,
        startCoord,
        endCoord,
        overrides,
        'astar',
      ) as StrategyRouteVariant[];

      expect(Array.isArray(wasmVariants)).toBe(true);
      expect(wasmVariants.length).toBeGreaterThan(0);

      // 2. TypeScript router variants using identical mock graph parsed by OSMGraphParser
      const tsParser = new OSMGraphParser();
      const tsGraph = tsParser.parse({ elements: [] }); // Falls back to loadMockGraph
      const tsRouter = new AStarRouter();

      const strategies = [
        { label: 'standard', costFn: standardCost },
        { label: 'avoid-stops', costFn: avoidStoppingCost },
        { label: 'quiet-streets', costFn: avoidBusyRoadsCost },
      ] as const;

      for (const strat of strategies) {
        const wasmVariant = wasmVariants.find((v) => v.label === strat.label);
        expect(wasmVariant).toBeDefined();
        if (!wasmVariant) continue;

        const tsResult = tsRouter.findRoute(tsGraph, startCoord, endCoord, strat.costFn, overrides);
        expect(tsResult).not.toBeNull();
        if (!tsResult) continue;

        // Path nodes must be identical
        expect(wasmVariant.result.pathNodeIds).toEqual(tsResult.pathNodeIds);

        // Distance and duration should match within 0.1 tolerance
        expect(wasmVariant.result.totalDistanceMeters).toBeCloseTo(tsResult.totalDistanceMeters, 1);
        expect(wasmVariant.result.totalDurationSeconds).toBeCloseTo(
          tsResult.totalDurationSeconds,
          1,
        );
      }
    });

    it('matches routes when calling find_route_variants_from_js_graph', () => {
      const tsParser = new OSMGraphParser();
      const tsGraph = tsParser.parse({ elements: [] });
      const jsGraphForWasm = {
        nodes: Array.from(tsGraph.nodes.entries()),
      };

      const variants = WasmEngine.find_route_variants_from_js_graph(
        jsGraphForWasm,
        startCoord,
        endCoord,
        overrides,
        'dijkstra',
      ) as StrategyRouteVariant[];

      expect(Array.isArray(variants)).toBe(true);
      expect(variants).toHaveLength(3);
      const standard = variants.find((v) => v.label === 'standard');
      expect(standard).toBeDefined();
      expect(standard?.result.pathNodeIds.length).toBeGreaterThan(1);
    });

    it('verifies Dijkstra vs A* parity in WASM engine', () => {
      const wasmGraph = WasmEngine.load_mock_graph();
      const astar = WasmEngine.find_route_variants_astar(
        wasmGraph,
        startCoord,
        endCoord,
        overrides,
      ) as StrategyRouteVariant[];
      const dijkstra = WasmEngine.find_route_variants_dijkstra(
        wasmGraph,
        startCoord,
        endCoord,
        overrides,
      ) as StrategyRouteVariant[];

      expect(astar.length).toBe(dijkstra.length);
      for (let i = 0; i < astar.length; i++) {
        const a = astar[i];
        const d = dijkstra[i];
        expect(a).toBeDefined();
        expect(d).toBeDefined();
        if (!a || !d) continue;
        expect(a.label).toBe(d.label);
        expect(a.result.pathNodeIds).toEqual(d.result.pathNodeIds);
        expect(a.result.totalDurationSeconds).toBeCloseTo(d.result.totalDurationSeconds, 4);
        expect(a.result.totalDistanceMeters).toBeCloseTo(d.result.totalDistanceMeters, 4);
      }
    });
  });
});
