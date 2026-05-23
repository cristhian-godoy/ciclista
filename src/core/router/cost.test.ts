import { describe, it, expect } from 'vitest';
import { calculateDisplayCost, standardCost, avoidStoppingCost, avoidBusyRoadsCost, getDefaultNodeDelay } from './cost';
import { DijkstraRouter } from './router';
import type { GraphNode, GraphEdge, StreetGraph, LocalOverrides } from '../types';

describe('getDefaultNodeDelay', () => {
  it('returns correct delays for various node types', () => {
    expect(getDefaultNodeDelay({ highway: 'traffic_signals' })).toBe(15);
    expect(getDefaultNodeDelay({ crossing: 'traffic_signals' })).toBe(15);
    expect(getDefaultNodeDelay({ highway: 'give_way' })).toBe(3);
    expect(getDefaultNodeDelay({ highway: 'stop' })).toBe(8);
    expect(getDefaultNodeDelay({ highway: 'crossing' })).toBe(3);
    expect(getDefaultNodeDelay({ crossing: 'uncontrolled' })).toBe(3);
    expect(getDefaultNodeDelay({})).toBe(0);
  });
});

describe('calculateDisplayCost', () => {
  const nodeA: GraphNode = { id: 'A', lat: 48.137, lng: 11.575, tags: {} };
  const nodeB: GraphNode = { id: 'B', lat: 48.138, lng: 11.576, tags: {} };
  const nodeC: GraphNode = { id: 'C', lat: 48.139, lng: 11.577, tags: { highway: 'traffic_signals' } };

  const edgeAB: GraphEdge = { target: 'B', distance: 120, name: 'Street AB', tags: { highway: 'cycleway' } };
  const edgeBC: GraphEdge = { target: 'C', distance: 180, name: 'Street BC', tags: { highway: 'primary' } };

  const graph: StreetGraph = {
    nodes: new Map([
      ['A', { node: nodeA, edges: [edgeAB] }],
      ['B', { node: nodeB, edges: [edgeBC] }],
      ['C', { node: nodeC, edges: [] }],
    ]),
  };

  const emptyOverrides: LocalOverrides = {
    nodeDelays: new Map(),
    nodeNotes: new Map(),
    nodeTurns: new Map(),
  };

  it('calculates travel time using distance / speed with default profile (normal)', () => {
    // Normal profile: cycleway speed = 6.0 m/s, target B has 0 delay
    // 120m / 6.0 m/s = 20s
    const time = calculateDisplayCost('A', edgeAB, 'B', emptyOverrides, graph);
    expect(time).toBeCloseTo(20, 1);
  });

  it('applies bike profile multipliers correctly', () => {
    // slow profile speed = 6.0 * (15/18) = 5.0 m/s
    // 120m / 5.0 m/s = 24s
    const slowOverrides: LocalOverrides = {
      ...emptyOverrides,
      bikeProfile: 'slow',
    };
    const timeSlow = calculateDisplayCost('A', edgeAB, 'B', slowOverrides, graph);
    expect(timeSlow).toBeCloseTo(24, 1);

    // ebike profile speed = 6.0 * (25/18) = 8.333 m/s
    // 120m / 8.333 m/s = 14.4s
    const ebikeOverrides: LocalOverrides = {
      ...emptyOverrides,
      bikeProfile: 'ebike',
    };
    const timeEbike = calculateDisplayCost('A', edgeAB, 'B', ebikeOverrides, graph);
    expect(timeEbike).toBeCloseTo(14.4, 1);
  });

  it('adds target node delay when no custom overrides are present', () => {
    // primary speed = 4.0 m/s (hardcoded fallback)
    // distance = 180m -> 180 / 4.0 = 45s
    // target C has traffic_signals -> +15s default delay
    // Total = 60s
    const time = calculateDisplayCost('B', edgeBC, 'C', emptyOverrides, graph);
    expect(time).toBeCloseTo(60, 1);
  });

  it('respects custom node delay overrides', () => {
    const customOverrides: LocalOverrides = {
      ...emptyOverrides,
      nodeDelays: new Map([['C', 5]]), // custom delay of 5s instead of 15s
    };
    // 180 / 4.0 = 45s + 5s = 50s
    const time = calculateDisplayCost('B', edgeBC, 'C', customOverrides, graph);
    expect(time).toBeCloseTo(50, 1);
  });
});

describe('DijkstraRouter separate routing weight from display time', () => {
  it('prefers cycleway but reports actual calibrated display time', () => {
    // Construct a graph with two paths from A to C:
    // Path 1 (preferred but longer): A -> B -> C via cycleways
    //   A -> B: 180m, cycleway (6m/s -> 30s display)
    //   B -> C: 180m, cycleway (6m/s -> 30s display)
    //   Total display cost = 60s
    //   Total routing cost = 60s
    // Path 2 (shorter but heavily penalized): A -> C via pedestrian zone without bicycle=yes
    //   A -> C: 100m, pedestrian (1.2m/s -> 83.3s display)
    //   Wait, standardCost adds heavy penalty for footway/pedestrian without bicycle=yes (+60s and *4)
    //   Routing cost = (100 / 1.2 + 60) * 4 = 143.3 * 4 = 573.3s
    // DijkstraRouter should choose Path 1 because routing cost (60s) < Path 2 routing cost (573s)
    // And it should return totalDurationSeconds = 60s (display cost), not routing cost.

    const nodeA: GraphNode = { id: 'A', lat: 48.137, lng: 11.575, tags: {} };
    const nodeB: GraphNode = { id: 'B', lat: 48.138, lng: 11.576, tags: {} };
    const nodeC: GraphNode = { id: 'C', lat: 48.139, lng: 11.577, tags: {} };

    const edgeAB: GraphEdge = { target: 'B', distance: 180, name: 'Street AB', tags: { highway: 'cycleway' } };
    const edgeBA: GraphEdge = { target: 'A', distance: 180, name: 'Street AB', tags: { highway: 'cycleway' } };
    const edgeBC: GraphEdge = { target: 'C', distance: 180, name: 'Street BC', tags: { highway: 'cycleway' } };
    const edgeCB: GraphEdge = { target: 'B', distance: 180, name: 'Street BC', tags: { highway: 'cycleway' } };
    const edgeAC: GraphEdge = { target: 'C', distance: 100, name: 'Street AC', tags: { highway: 'pedestrian' } };
    const edgeCA: GraphEdge = { target: 'A', distance: 100, name: 'Street AC', tags: { highway: 'pedestrian' } };

    const graph: StreetGraph = {
      nodes: new Map([
        ['A', { node: nodeA, edges: [edgeAB, edgeAC] }],
        ['B', { node: nodeB, edges: [edgeBC, edgeBA] }],
        ['C', { node: nodeC, edges: [edgeCB, edgeCA] }],
      ]),
    };

    const router = new DijkstraRouter();
    const result = router.findRoute(
      graph,
      { lat: nodeA.lat, lng: nodeA.lng },
      { lat: nodeC.lat, lng: nodeC.lng },
      standardCost,
      { nodeDelays: new Map(), nodeNotes: new Map(), nodeTurns: new Map() }
    );

    expect(result).not.toBeNull();
    // Path should start at virtual-start and end at virtual-end, containing B
    expect(result!.pathNodeIds[0]).toBe('virtual-start');
    expect(result!.pathNodeIds[result!.pathNodeIds.length - 1]).toBe('virtual-end');
    expect(result!.pathNodeIds).toContain('B');
    // totalDurationSeconds should be the display cost (~52.3s), not the routing cost
    expect(result!.totalDurationSeconds).toBeCloseTo(52.3, 1);
  });
});
