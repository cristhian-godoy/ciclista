import { describe, expect, it } from 'vitest';

import type { LocalOverrides } from '../config';
import type { GraphNode, StreetGraph } from '../graph/types';
import type { RouteResult } from '../router/types';
import { evaluateIntersectionBranches } from './evaluator';

describe('evaluateIntersectionBranches', () => {
  const nodeA: GraphNode = { id: 'A', lat: 48.137, lng: 11.575, tags: {} };
  const nodeB: GraphNode = { id: 'B', lat: 48.138, lng: 11.576, tags: {} };
  const nodeC: GraphNode = {
    id: 'C',
    lat: 48.139,
    lng: 11.577,
    tags: { highway: 'traffic_signals' },
  };
  const nodeD: GraphNode = { id: 'D', lat: 48.1385, lng: 11.578, tags: {} };

  // Main chosen path is A -> B -> C
  // Alternative branch at B is B -> D -> C
  const graph: StreetGraph = {
    nodes: new Map([
      [
        'A',
        {
          node: nodeA,
          edges: [
            { target: 'B', distance: 100, name: 'Street AB', tags: { highway: 'residential' } },
          ],
        },
      ],
      [
        'B',
        {
          node: nodeB,
          edges: [
            { target: 'C', distance: 100, name: 'Street BC', tags: { highway: 'residential' } },
            { target: 'D', distance: 80, name: 'Street BD', tags: { highway: 'residential' } },
          ],
        },
      ],
      [
        'C',
        {
          node: nodeC,
          edges: [],
        },
      ],
      [
        'D',
        {
          node: nodeD,
          edges: [
            { target: 'C', distance: 80, name: 'Street DC', tags: { highway: 'residential' } },
          ],
        },
      ],
    ]),
  };

  const defaultOverrides: LocalOverrides = {
    nodeDelays: new Map(),
    nodeNotes: new Map(),
    nodeTurns: new Map(),
    bikeConfig: { id: 'normal' },
  };

  const routeResult: RouteResult = {
    pathNodeIds: ['A', 'B', 'C'],
    coordinates: [
      { lat: 48.137, lng: 11.575 },
      { lat: 48.138, lng: 11.576 },
      { lat: 48.139, lng: 11.577 },
    ],
    totalDurationSeconds: 60,
    totalDistanceMeters: 200,
    streets: ['Street AB', 'Street BC'],
    trafficSignalsCount: 1,
    signalCount: 1,
    yieldCount: 0,
    crossingCount: 0,
    roadTypeTotals: {},
    surfaceTotals: { paved: 200, gravel: 0, cobblestone: 0 },
    edges: [
      {
        sourceId: 'A',
        targetId: 'B',
        name: 'Street AB',
        distance: 100,
        highway: 'residential',
        tags: { highway: 'residential' },
        cost: 30,
        matchedSign: null,
        matchedRoad: 'residential',
      },
      {
        sourceId: 'B',
        targetId: 'C',
        name: 'Street BC',
        distance: 100,
        highway: 'residential',
        tags: { highway: 'residential' },
        cost: 30,
        matchedSign: null,
        matchedRoad: 'residential',
      },
    ],
  };

  it('returns empty array when node is not in route path', () => {
    const branches = evaluateIntersectionBranches('D', routeResult, graph, defaultOverrides);
    expect(branches).toEqual([]);
  });

  it('correctly calculates branch evaluations at B', () => {
    const branches = evaluateIntersectionBranches('B', routeResult, graph, defaultOverrides);

    // There are 2 outgoing edges from B: to C (chosen) and to D (alternative)
    expect(branches.length).toBe(2);

    const branchD = branches.find((b) => b.targetId === 'D')!;
    expect(branchD).toBeDefined();
    expect(branchD.targetId).toBe('D');
    expect(branchD.name).toBe('Street BD');
    expect(branchD.distance).toBe(80);
    expect(branchD.chosenRemainingDistance).toBe(100); // B -> C remaining distance is 100

    // Check that Dijkstra projection computed the path all the way to destination C
    expect(branchD.altPathNodeIds).toEqual(['D', 'C']);
    expect(branchD.altDistanceMeters).toBe(160); // B -> D -> C is 80 + 80 = 160
    expect(branchD.altSignalCount).toBe(1); // Node C is a signal
  });
});
