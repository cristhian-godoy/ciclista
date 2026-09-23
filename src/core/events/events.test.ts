import { describe, expect, it } from 'vitest';

import type { LocalOverrides } from '../config';
import type { GraphEdge, GraphNode, StreetGraph } from '../graph/types';
import {
  avoidBusyRoadsCost,
  avoidStoppingCost,
  isEdgeBlocked,
  quietStreetsCost,
  standardCost,
  stopAvoidanceCost,
} from '../router/strategies';
import type { MapEvent } from './types';

describe('Road Blockage Events & Router Penalties', () => {
  const nodeA: GraphNode = { id: 'A', lat: 48.137, lng: 11.575, tags: {} };
  const nodeB: GraphNode = { id: 'B', lat: 48.138, lng: 11.576, tags: {} };

  const edgeAB: GraphEdge = {
    target: 'B',
    distance: 120,
    name: 'Main Street',
    tags: { highway: 'residential' },
  };

  const graph: StreetGraph = {
    nodes: new Map([
      ['A', { node: nodeA, edges: [edgeAB] }],
      ['B', { node: nodeB, edges: [] }],
    ]),
  };

  const createBaseOverrides = (): LocalOverrides => ({
    nodeDelays: new Map(),
    nodeNotes: new Map(),
    nodeTurns: new Map(),
  });

  describe('isEdgeBlocked', () => {
    it('returns false when overrides or blocked collections are empty', () => {
      expect(isEdgeBlocked('A', 'B', undefined)).toBe(false);
      expect(isEdgeBlocked('A', 'B', createBaseOverrides())).toBe(false);
    });

    it('identifies forward and reverse blocked edges in blockedEdges set', () => {
      const overridesForward: LocalOverrides = {
        ...createBaseOverrides(),
        blockedEdges: new Set(['A->B']),
      };
      expect(isEdgeBlocked('A', 'B', overridesForward)).toBe(true);
      expect(isEdgeBlocked('B', 'A', overridesForward)).toBe(true);
      expect(isEdgeBlocked('A', 'C', overridesForward)).toBe(false);

      const overridesReverse: LocalOverrides = {
        ...createBaseOverrides(),
        blockedEdges: new Set(['B->A']),
      };
      expect(isEdgeBlocked('A', 'B', overridesReverse)).toBe(true);
    });

    it('identifies edges blocked by active road_blockage events', () => {
      const activeEvent: MapEvent = {
        id: 'event-1',
        name: 'Construction Closure',
        active: true,
        edgeIds: ['A->B'],
        effect: { type: 'road_blockage', penaltySeconds: 30 },
        createdAt: 1700000000000,
      };

      const overrides: LocalOverrides = {
        ...createBaseOverrides(),
        events: [activeEvent],
      };

      expect(isEdgeBlocked('A', 'B', overrides)).toBe(true);
      expect(isEdgeBlocked('B', 'A', overrides)).toBe(true);
      expect(isEdgeBlocked('A', 'C', overrides)).toBe(false);
    });

    it('ignores inactive road_blockage events', () => {
      const inactiveEvent: MapEvent = {
        id: 'event-2',
        name: 'Cleared Incident',
        active: false,
        edgeIds: ['A->B'],
        effect: { type: 'road_blockage', penaltySeconds: 30 },
        createdAt: 1700000000000,
      };

      const overrides: LocalOverrides = {
        ...createBaseOverrides(),
        events: [inactiveEvent],
      };

      expect(isEdgeBlocked('A', 'B', overrides)).toBe(false);
    });
  });

  describe('standardCost 30s road blockage penalty', () => {
    it('adds 30 seconds penalty when edge is in blockedEdges', () => {
      const baseOverrides = createBaseOverrides();
      const baseCost = standardCost('A', edgeAB, 'B', baseOverrides, graph);

      const blockedOverrides: LocalOverrides = {
        ...baseOverrides,
        blockedEdges: new Set(['A->B']),
      };
      const blockedCost = standardCost('A', edgeAB, 'B', blockedOverrides, graph);

      expect(blockedCost - baseCost).toBeCloseTo(30, 2);
    });

    it('adds 30 seconds penalty for reverse edge key in blockedEdges', () => {
      const baseOverrides = createBaseOverrides();
      const baseCost = standardCost('A', edgeAB, 'B', baseOverrides, graph);

      const blockedOverrides: LocalOverrides = {
        ...baseOverrides,
        blockedEdges: new Set(['B->A']),
      };
      const blockedCost = standardCost('A', edgeAB, 'B', blockedOverrides, graph);

      expect(blockedCost - baseCost).toBeCloseTo(30, 2);
    });

    it('adds 30 seconds penalty when edge matches an active road_blockage event', () => {
      const baseOverrides = createBaseOverrides();
      const baseCost = standardCost('A', edgeAB, 'B', baseOverrides, graph);

      const activeEvent: MapEvent = {
        id: 'event-block-1',
        name: 'Street Fair',
        active: true,
        edgeIds: ['A->B'],
        effect: { type: 'road_blockage', penaltySeconds: 30 },
        createdAt: Date.now(),
      };

      const eventOverrides: LocalOverrides = {
        ...baseOverrides,
        events: [activeEvent],
      };
      const eventCost = standardCost('A', edgeAB, 'B', eventOverrides, graph);

      expect(eventCost - baseCost).toBeCloseTo(30, 2);
    });

    it('does not add penalty when road_blockage event is inactive', () => {
      const baseOverrides = createBaseOverrides();
      const baseCost = standardCost('A', edgeAB, 'B', baseOverrides, graph);

      const inactiveEvent: MapEvent = {
        id: 'event-block-2',
        name: 'Past Construction',
        active: false,
        edgeIds: ['A->B'],
        effect: { type: 'road_blockage', penaltySeconds: 30 },
        createdAt: Date.now(),
      };

      const eventOverrides: LocalOverrides = {
        ...baseOverrides,
        events: [inactiveEvent],
      };
      const eventCost = standardCost('A', edgeAB, 'B', eventOverrides, graph);

      expect(eventCost).toBe(baseCost);
    });
  });

  describe('stopAvoidanceCost (avoidStoppingCost) 30s road blockage penalty', () => {
    it('adds 30 seconds penalty when edge is in blockedEdges', () => {
      const baseOverrides = createBaseOverrides();
      const baseCost = avoidStoppingCost('A', edgeAB, 'B', baseOverrides, graph);

      const blockedOverrides: LocalOverrides = {
        ...baseOverrides,
        blockedEdges: new Set(['A->B']),
      };
      const blockedCost = avoidStoppingCost('A', edgeAB, 'B', blockedOverrides, graph);

      expect(blockedCost - baseCost).toBeCloseTo(30, 2);
      expect(stopAvoidanceCost('A', edgeAB, 'B', blockedOverrides, graph)).toBe(blockedCost);
    });

    it('adds 30 seconds penalty when edge matches an active road_blockage event', () => {
      const baseOverrides = createBaseOverrides();
      const baseCost = avoidStoppingCost('A', edgeAB, 'B', baseOverrides, graph);

      const activeEvent: MapEvent = {
        id: 'event-stop-1',
        name: 'Emergency Road Work',
        active: true,
        edgeIds: ['A->B'],
        effect: { type: 'road_blockage', penaltySeconds: 30 },
        createdAt: Date.now(),
      };

      const eventOverrides: LocalOverrides = {
        ...baseOverrides,
        events: [activeEvent],
      };
      const eventCost = avoidStoppingCost('A', edgeAB, 'B', eventOverrides, graph);

      expect(eventCost - baseCost).toBeCloseTo(30, 2);
    });
  });

  describe('quietStreetsCost (avoidBusyRoadsCost) 30s road blockage penalty', () => {
    it('adds 30 seconds penalty when edge is in blockedEdges', () => {
      const baseOverrides = createBaseOverrides();
      const baseCost = avoidBusyRoadsCost('A', edgeAB, 'B', baseOverrides, graph);

      const blockedOverrides: LocalOverrides = {
        ...baseOverrides,
        blockedEdges: new Set(['A->B']),
      };
      const blockedCost = avoidBusyRoadsCost('A', edgeAB, 'B', blockedOverrides, graph);

      expect(blockedCost - baseCost).toBeCloseTo(30, 2);
      expect(quietStreetsCost('A', edgeAB, 'B', blockedOverrides, graph)).toBe(blockedCost);
    });

    it('adds 30 seconds penalty when edge matches an active road_blockage event', () => {
      const baseOverrides = createBaseOverrides();
      const baseCost = avoidBusyRoadsCost('A', edgeAB, 'B', baseOverrides, graph);

      const activeEvent: MapEvent = {
        id: 'event-quiet-1',
        name: 'Water Main Repair',
        active: true,
        edgeIds: ['A->B'],
        effect: { type: 'road_blockage', penaltySeconds: 30 },
        createdAt: Date.now(),
      };

      const eventOverrides: LocalOverrides = {
        ...baseOverrides,
        events: [activeEvent],
      };
      const eventCost = avoidBusyRoadsCost('A', edgeAB, 'B', eventOverrides, graph);

      expect(eventCost - baseCost).toBeCloseTo(30, 2);
    });
  });
});
