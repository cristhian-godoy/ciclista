import { describe, expect, it } from 'vitest';

import type { LocalOverrides } from '../config';
import type { GraphEdge, GraphNode, StreetGraph } from '../graph/types';
import { AStarRouter } from './astar';
import { getCrossingTurnEffect, isCrossingTurnDirectlyBanned } from './crossing-turns';
import { DijkstraRouter } from './router';
import { standardCost } from './strategies';

describe('Crossing Turn Penalties and Bans in Routing Engines', () => {
  const overridesWithTurns: LocalOverrides = {
    nodeDelays: new Map(),
    nodeNotes: new Map(),
    nodeTurns: new Map(),
    crossingTurns: [
      {
        id: 'turn-penalty-1',
        crossingId: 'crossing-C',
        fromNodeId: 'W',
        toNodeId: 'E',
        pathNodeIds: ['W', 'C', 'E'],
        timeDeltaSeconds: 30,
        banned: false,
        turnType: 'direct',
      },
      {
        id: 'turn-ban-1',
        crossingId: 'crossing-C',
        fromNodeId: 'S',
        toNodeId: 'N',
        pathNodeIds: ['S', 'C', 'N'],
        timeDeltaSeconds: 0,
        banned: true,
        turnType: 'direct',
      },
      {
        id: 'turn-direct-edge',
        crossingId: 'crossing-C',
        fromNodeId: 'A',
        toNodeId: 'B',
        pathNodeIds: ['A', 'B'],
        timeDeltaSeconds: -15,
        banned: false,
        turnType: 'green_arrow',
      },
    ],
  };

  describe('getCrossingTurnEffect evaluation', () => {
    it('returns zero delta and not banned when no crossing turns present', () => {
      const res = getCrossingTurnEffect('P', 'C', 'N');
      expect(res.isBanned).toBe(false);
      expect(res.timeDelta).toBe(0);
    });

    it('identifies 3-node turn sequence and applies time delta', () => {
      const res = getCrossingTurnEffect('W', 'C', 'E', overridesWithTurns);
      expect(res.isBanned).toBe(false);
      expect(res.timeDelta).toBe(30);
    });

    it('does not apply 3-node sequence when parent node differs', () => {
      const res = getCrossingTurnEffect('Other', 'C', 'E', overridesWithTurns);
      expect(res.isBanned).toBe(false);
      expect(res.timeDelta).toBe(0);
    });

    it('identifies 3-node banned turn sequence', () => {
      const res = getCrossingTurnEffect('S', 'C', 'N', overridesWithTurns);
      expect(res.isBanned).toBe(true);
      expect(res.timeDelta).toBe(0);
    });

    it('identifies direct 2-node turn priority buff', () => {
      const res = getCrossingTurnEffect(null, 'A', 'B', overridesWithTurns);
      expect(res.isBanned).toBe(false);
      expect(res.timeDelta).toBe(-15);
    });
  });

  describe('isCrossingTurnDirectlyBanned', () => {
    it('returns true if direct edge matches a banned crossing turn', () => {
      const overrides: LocalOverrides = {
        nodeDelays: new Map(),
        nodeNotes: new Map(),
        nodeTurns: new Map(),
        crossingTurns: [
          {
            id: 'banned-edge',
            crossingId: 'crossing-1',
            fromNodeId: 'X',
            toNodeId: 'Y',
            timeDeltaSeconds: 0,
            banned: true,
            turnType: 'direct',
          },
        ],
      };
      expect(isCrossingTurnDirectlyBanned('X', 'Y', overrides)).toBe(true);
      expect(isCrossingTurnDirectlyBanned('Y', 'X', overrides)).toBe(false);
    });
  });

  describe('Dijkstra and A* router integration', () => {
    // Triangle network with approach (10 -> 1) and departure (3 -> 30):
    // Path 1: 10 -> 1 -> 2 -> 3 -> 30 (distance: 50 + 100 + 100 + 50 = 300m)
    // Path 2: 10 -> 1 -> 4 -> 3 -> 30 (detour around, distance: 50 + 150 + 150 + 50 = 400m)
    const testGraph: StreetGraph = {
      nodes: new Map<string, { node: GraphNode; edges: GraphEdge[] }>([
        [
          '10',
          {
            node: { id: '10', lat: 48.125, lng: 11.57, tags: {} },
            edges: [{ target: '1', distance: 50, tags: { highway: 'cycleway' } }],
          },
        ],
        [
          '1',
          {
            node: { id: '1', lat: 48.13, lng: 11.57, tags: {} },
            edges: [
              { target: '2', distance: 100, tags: { highway: 'cycleway' } },
              { target: '4', distance: 150, tags: { highway: 'cycleway' } },
            ],
          },
        ],
        [
          '2',
          {
            node: { id: '2', lat: 48.131, lng: 11.571, tags: { highway: 'traffic_signals' } },
            edges: [{ target: '3', distance: 100, tags: { highway: 'cycleway' } }],
          },
        ],
        [
          '3',
          {
            node: { id: '3', lat: 48.132, lng: 11.572, tags: {} },
            edges: [{ target: '30', distance: 50, tags: { highway: 'cycleway' } }],
          },
        ],
        [
          '4',
          {
            node: { id: '4', lat: 48.1315, lng: 11.569, tags: {} },
            edges: [{ target: '3', distance: 150, tags: { highway: 'cycleway' } }],
          },
        ],
        [
          '30',
          {
            node: { id: '30', lat: 48.137, lng: 11.572, tags: {} },
            edges: [],
          },
        ],
      ]),
    };

    it('Dijkstra and A* choose Path 1 under default settings', () => {
      const start = { lat: 48.125, lng: 11.57 };
      const end = { lat: 48.137, lng: 11.572 };
      const emptyOverrides: LocalOverrides = {
        nodeDelays: new Map(),
        nodeNotes: new Map(),
        nodeTurns: new Map(),
      };

      const dijkstra = new DijkstraRouter();
      const astar = new AStarRouter();

      const rDijkstra = dijkstra.findRoute(testGraph, start, end, standardCost, emptyOverrides);
      const rAstar = astar.findRoute(testGraph, start, end, standardCost, emptyOverrides);

      expect(rDijkstra?.pathNodeIds).toContain('2');
      expect(rDijkstra?.pathNodeIds).not.toContain('4');
      expect(rAstar?.pathNodeIds).toContain('2');
      expect(rAstar?.pathNodeIds).not.toContain('4');
    });

    it('Dijkstra and A* detour to Path 2 when turn 1 -> 2 -> 3 is prohibited', () => {
      const start = { lat: 48.125, lng: 11.57 };
      const end = { lat: 48.137, lng: 11.572 };
      const bannedOverrides: LocalOverrides = {
        nodeDelays: new Map(),
        nodeNotes: new Map(),
        nodeTurns: new Map(),
        crossingTurns: [
          {
            id: 'ban-1-2-3',
            crossingId: 'crossing-2',
            fromNodeId: '1',
            toNodeId: '3',
            pathNodeIds: ['1', '2', '3'],
            timeDeltaSeconds: 0,
            banned: true,
            turnType: 'direct',
          },
        ],
      };

      const dijkstra = new DijkstraRouter();
      const astar = new AStarRouter();

      const rDijkstra = dijkstra.findRoute(testGraph, start, end, standardCost, bannedOverrides);
      const rAstar = astar.findRoute(testGraph, start, end, standardCost, bannedOverrides);

      expect(rDijkstra?.pathNodeIds).toContain('4');
      expect(rDijkstra?.pathNodeIds).not.toContain('2');
      expect(rAstar?.pathNodeIds).toContain('4');
      expect(rAstar?.pathNodeIds).not.toContain('2');
    });

    it('applies time penalty to route duration when turn is configured with positive delta', () => {
      const start = { lat: 48.125, lng: 11.57 };
      const end = { lat: 48.137, lng: 11.572 };
      const emptyOverrides: LocalOverrides = {
        nodeDelays: new Map(),
        nodeNotes: new Map(),
        nodeTurns: new Map(),
      };
      const penaltyOverrides: LocalOverrides = {
        nodeDelays: new Map(),
        nodeNotes: new Map(),
        nodeTurns: new Map(),
        crossingTurns: [
          {
            id: 'penalty-1-2-3',
            crossingId: 'crossing-2',
            fromNodeId: '1',
            toNodeId: '3',
            pathNodeIds: ['1', '2', '3'],
            timeDeltaSeconds: 2,
            banned: false,
            turnType: 'direct',
          },
        ],
      };

      const dijkstra = new DijkstraRouter();
      const rBase = dijkstra.findRoute(testGraph, start, end, standardCost, emptyOverrides);
      const rPenalized = dijkstra.findRoute(testGraph, start, end, standardCost, penaltyOverrides);

      expect(rBase).not.toBeNull();
      expect(rPenalized).not.toBeNull();
      expect(rPenalized!.pathNodeIds).toContain('2');
      expect(rPenalized!.totalDurationSeconds).toBeCloseTo(rBase!.totalDurationSeconds + 2, 1);
    });
  });
});
