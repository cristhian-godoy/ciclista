import { describe, expect, it } from 'vitest';

import type { Coordinate } from '../common/types';
import type { LocalOverrides } from '../config';
import { OSMGraphParser } from '../graph/parser';
import type { StreetGraph } from '../graph/types';
import { standardCost } from './cost';
import { DijkstraRouter } from './router';

describe('DijkstraRouter', () => {
  const parser = new OSMGraphParser();
  const graph: StreetGraph = parser.parse(null); // Loads the mock Munich graph
  const router = new DijkstraRouter();

  const defaultOverrides: LocalOverrides = {
    nodeDelays: new Map(),
    nodeNotes: new Map(),
    nodeTurns: new Map(),
    bikeConfig: { id: 'normal' },
  };

  it('calculates optimal path between two points in mock graph', () => {
    const start: Coordinate = { lat: 48.13715, lng: 11.5754 }; // Home (Marienplatz)
    const end: Coordinate = { lat: 48.135, lng: 11.582 }; // Office (Isartor)

    const result = router.findRoute(graph, start, end, standardCost, defaultOverrides);

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

  it('handles same-edge direct routing where start and end project onto the same edge', () => {
    // Both coords are placed on "Theatinerstraße" between node 1 and 2
    const start: Coordinate = { lat: 48.138, lng: 11.576 };
    const end: Coordinate = { lat: 48.139, lng: 11.5765 };

    const result = router.findRoute(graph, start, end, standardCost, defaultOverrides);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.streets).toContain('Theatinerstraße');
      expect(result.totalDistanceMeters).toBeGreaterThan(0);
    }
  });

  it('returns null safely when destination is completely unreachable', () => {
    // Construct an isolated graph with 2 disjoint components
    const disjointGraph: StreetGraph = {
      nodes: new Map([
        [
          '1',
          {
            node: { id: '1', lat: 48.1, lng: 11.1, tags: {} },
            edges: [], // no outgoing edges
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

    const result = router.findRoute(disjointGraph, start, end, standardCost, defaultOverrides);
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
        // Note: Node B is referenced as target but not present as a key in nodes Map
      ]),
    };

    const start: Coordinate = { lat: 48.1, lng: 11.1 };
    const end: Coordinate = { lat: 48.11, lng: 11.11 };

    // Since B is missing, it should fall back to node snapping/fallback route method or return null/fallback
    // Here both findNearestEdge will fail to lookup B (or findNearestNode snaps A)
    expect(() => {
      const route = router.findRoute(corruptGraph, start, end, standardCost, defaultOverrides);
      if (route) {
        expect(route.pathNodeIds).toContain('A');
      }
    }).not.toThrow();
  });

  it('populates alternativeEvaluations correctly without tracing back to start', () => {
    const start: Coordinate = { lat: 48.13715, lng: 11.5754 }; // Home (Marienplatz)
    const end: Coordinate = { lat: 48.135, lng: 11.582 }; // Office (Isartor)

    const result = router.findRoute(graph, start, end, standardCost, defaultOverrides);

    expect(result).not.toBeNull();
    if (result && result.alternativeEvaluations) {
      // Find a node that has at least one alternative evaluation
      const entries = Object.entries(result.alternativeEvaluations);
      const entryWithAlternatives = entries.find(([nodeId, evals]) => {
        const pathIndex = result.pathNodeIds.indexOf(nodeId);
        const nextNodeOnPath = result.pathNodeIds[pathIndex + 1];
        return evals.some((ev) => ev.targetId !== nextNodeOnPath);
      });

      expect(entryWithAlternatives).toBeDefined();
      if (entryWithAlternatives) {
        const [nodeId, evals] = entryWithAlternatives;
        const pathIndex = result.pathNodeIds.indexOf(nodeId);
        const nextNodeOnPath = result.pathNodeIds[pathIndex + 1];
        const alternativeEval = evals.find((ev) => ev.targetId !== nextNodeOnPath);

        expect(alternativeEval).toBeDefined();
        if (alternativeEval) {
          expect(alternativeEval.chosenRemainingDuration).toBeDefined();
          expect(alternativeEval.chosenRemainingDistance).toBeDefined();
          expect(alternativeEval.chosenRemainingSignals).toBeDefined();
        }
      }
    }
  });

  it('applies custom semantic turn overrides during routing', () => {
    // Construct a path: A -> B -> C -> D -> E
    // Turn at C (between B and D) is a left turn.
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

    // 1. Without overrides (default left turn penalty = 4s)
    const result1 = router.findRoute(testGraph, start, end, standardCost, defaultOverrides);
    expect(result1).not.toBeNull();
    const durationWithoutOverride = result1!.totalDurationSeconds;

    // 2. With a custom green arrow right turn override at C for maneuver B->D (which is 0s penalty)
    const nodeTurnsMap = new Map();
    nodeTurnsMap.set('C', {
      'B->D': 'green_arrow_right',
    });
    const overridesWithTurn: LocalOverrides = {
      ...defaultOverrides,
      nodeTurns: nodeTurnsMap,
    };

    const result2 = router.findRoute(testGraph, start, end, standardCost, overridesWithTurn);
    expect(result2).not.toBeNull();
    const durationWithOverride = result2!.totalDurationSeconds;

    // The duration with override should be exactly 4 seconds less than without override
    expect(durationWithoutOverride - durationWithOverride).toBeCloseTo(4, 1);
  });
});
