import { describe, expect, it } from 'vitest';

import type { Coordinate } from '../common/types';
import type { LocalOverrides } from '../config';
import { OSMGraphParser } from '../graph/parser';
import type { StreetGraph } from '../graph/types';
import { AStarRouter } from './astar';
import { DijkstraRouter } from './router';
import { avoidBusyRoadsCost, avoidStoppingCost, standardCost } from './strategies';

describe('AStarRouter (Bidirectional A*)', () => {
  const parser = new OSMGraphParser();
  const graph: StreetGraph = parser.parse(null); // Loads the mock Munich graph
  const astar = new AStarRouter();
  const dijkstra = new DijkstraRouter();

  const defaultOverrides: LocalOverrides = {
    nodeDelays: new Map(),
    nodeNotes: new Map(),
    nodeTurns: new Map(),
    bikeConfig: { id: 'normal' },
  };

  it('calculates optimal path between two points in mock graph', () => {
    const start: Coordinate = { lat: 48.13715, lng: 11.5754 }; // Home (Marienplatz)
    const end: Coordinate = { lat: 48.135, lng: 11.582 }; // Office (Isartor)

    const result = astar.findRoute(graph, start, end, standardCost, defaultOverrides);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.pathNodeIds.length).toBeGreaterThanOrEqual(2);
      expect(result.totalDistanceMeters).toBeGreaterThan(0);
      expect(result.totalDurationSeconds).toBeGreaterThan(0);
      expect(result.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(result.surfaceTotals).toBeDefined();
      expect(result.surfaceTotals.paved).toBeGreaterThanOrEqual(0);
      expect(result.surfaceTotals.gravel).toBeGreaterThanOrEqual(0);
      expect(result.surfaceTotals.cobblestone).toBeGreaterThanOrEqual(0);
    }
  });

  it('guarantees optimality parity with DijkstraRouter across all strategy profiles', () => {
    const start: Coordinate = { lat: 48.13715, lng: 11.5754 };
    const end: Coordinate = { lat: 48.135, lng: 11.582 };

    const strategies = [
      { name: 'standard', costFn: standardCost },
      { name: 'avoid-stops', costFn: avoidStoppingCost },
      { name: 'quiet-streets', costFn: avoidBusyRoadsCost },
    ];

    for (const { name, costFn } of strategies) {
      const astarRes = astar.findRoute(graph, start, end, costFn, defaultOverrides);
      const dijkstraRes = dijkstra.findRoute(graph, start, end, costFn, defaultOverrides);

      expect(astarRes, `A* result for ${name} should not be null`).not.toBeNull();
      expect(dijkstraRes, `Dijkstra result for ${name} should not be null`).not.toBeNull();

      if (astarRes && dijkstraRes) {
        expect(
          astarRes.totalDistanceMeters,
          `Distance parity mismatch for strategy ${name}`,
        ).toBeCloseTo(dijkstraRes.totalDistanceMeters, 1);
        expect(
          astarRes.totalDurationSeconds,
          `Duration parity mismatch for strategy ${name}`,
        ).toBeCloseTo(dijkstraRes.totalDurationSeconds, 1);
        expect(astarRes.pathNodeIds).toEqual(dijkstraRes.pathNodeIds);
      }
    }
  });

  it('handles same-edge direct routing where start and end project onto the same edge', () => {
    const start: Coordinate = { lat: 48.138, lng: 11.576 };
    const end: Coordinate = { lat: 48.139, lng: 11.5765 };

    const result = astar.findRoute(graph, start, end, standardCost, defaultOverrides);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.streets).toContain('Theatinerstraße');
      expect(result.totalDistanceMeters).toBeGreaterThan(0);
    }
  });

  it('returns null safely when destination is completely unreachable', () => {
    const disjointGraph: StreetGraph = {
      nodes: new Map([
        [
          '1',
          {
            node: { id: '1', lat: 48.1, lng: 11.1, tags: {} },
            edges: [],
          },
        ],
        [
          '2',
          {
            node: { id: '2', lat: 48.2, lng: 11.2, tags: {} },
            edges: [],
          },
        ],
      ]),
    };

    const start: Coordinate = { lat: 48.1, lng: 11.1 };
    const end: Coordinate = { lat: 48.2, lng: 11.2 };

    const result = astar.findRoute(disjointGraph, start, end, standardCost, defaultOverrides);
    expect(result).toBeNull();
  });

  it('falls back safely to node snapping when start/end project to missing reference nodes', () => {
    const corruptGraph: StreetGraph = {
      nodes: new Map([
        [
          'A',
          {
            node: { id: 'A', lat: 48.1, lng: 11.1, tags: {} },
            edges: [
              {
                target: 'B',
                distance: 100,
                tags: { highway: 'residential' },
              },
            ],
          },
        ],
      ]),
    };

    const start: Coordinate = { lat: 48.1, lng: 11.1 };
    const end: Coordinate = { lat: 48.11, lng: 11.11 };

    expect(() => {
      const route = astar.findRoute(corruptGraph, start, end, standardCost, defaultOverrides);
      if (route) {
        expect(route.pathNodeIds).toContain('A');
      }
    }).not.toThrow();
  });

  it('applies custom semantic turn overrides during routing', () => {
    const testGraph: StreetGraph = {
      nodes: new Map([
        [
          'A',
          {
            node: { id: 'A', lat: 0.0, lng: 0.0, tags: {} },
            edges: [{ target: 'B', distance: 100, tags: { highway: 'residential' } }],
          },
        ],
        [
          'B',
          {
            node: { id: 'B', lat: 1.0, lng: 0.0, tags: {} },
            edges: [{ target: 'C', distance: 100, tags: { highway: 'residential' } }],
          },
        ],
        [
          'C',
          {
            node: { id: 'C', lat: 2.0, lng: 0.0, tags: {} },
            edges: [{ target: 'D', distance: 100, tags: { highway: 'residential' } }],
          },
        ],
        [
          'D',
          {
            node: { id: 'D', lat: 2.0, lng: -1.0, tags: {} },
            edges: [{ target: 'E', distance: 100, tags: { highway: 'residential' } }],
          },
        ],
        [
          'E',
          {
            node: { id: 'E', lat: 2.0, lng: -2.0, tags: {} },
            edges: [],
          },
        ],
      ]),
    };

    const start: Coordinate = { lat: 0.0, lng: 0.0 };
    const end: Coordinate = { lat: 2.0, lng: -2.0 };

    const result1 = astar.findRoute(testGraph, start, end, standardCost, defaultOverrides);
    expect(result1).not.toBeNull();
    const durationWithoutOverride = result1!.totalDurationSeconds;

    const nodeTurnsMap = new Map();
    nodeTurnsMap.set('C', {
      'B->D': 'green_arrow_right',
    });
    const overridesWithTurn: LocalOverrides = {
      ...defaultOverrides,
      nodeTurns: nodeTurnsMap,
    };

    const result2 = astar.findRoute(testGraph, start, end, standardCost, overridesWithTurn);
    expect(result2).not.toBeNull();
    const durationWithOverride = result2!.totalDurationSeconds;

    expect(durationWithoutOverride - durationWithOverride).toBeCloseTo(4, 1);
  });
});
