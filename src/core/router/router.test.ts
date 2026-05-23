import { describe, it, expect } from 'vitest';
import { DijkstraRouter } from './router';
import { OSMGraphParser } from '../graph/parser';
import { standardCost } from './cost';
import type { StreetGraph, Coordinate, LocalOverrides } from '../types';

describe('DijkstraRouter', () => {
  const parser = new OSMGraphParser();
  const graph: StreetGraph = parser.parse(null); // Loads the mock Munich graph
  const router = new DijkstraRouter();

  const defaultOverrides: LocalOverrides = {
    nodeDelays: new Map(),
    nodeNotes: new Map(),
    nodeTurns: new Map(),
    bikeProfile: 'normal',
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
});
