import { describe, expect, it } from 'vitest';

import { calculateTurnPenalty } from '../common/geometry';
import type { GraphEdge, GraphNode, StreetGraph } from '../graph/types';
import type { LocalOverrides } from '../storage/types';
import {
  avoidBusyRoadsCost,
  calculateDisplayCost,
  getDefaultNodeDelay,
  resolveRuleSpeed,
  standardCost,
} from './cost';
import { DijkstraRouter } from './router';
import type { NodeDelayConfig, RoadRuleConfig, SignRuleConfig } from './types';
import { InfrastructureType, RoadType } from './types';

describe('resolveRuleSpeed', () => {
  it('resolves relative speed type correctly based on profile', () => {
    const cfg: RoadRuleConfig = {
      roadId: RoadType.RESIDENTIAL,
      name: 'Residential',
      baseSpeedKmh: 17,
      speedType: 'relative',
      flatPenaltySeconds: 0,
    };
    expect(resolveRuleSpeed(cfg, 'slow')).toBe(15);
    expect(resolveRuleSpeed(cfg, 'normal')).toBe(18);
    expect(resolveRuleSpeed(cfg, 'ebike')).toBe(25);
  });

  it('resolves fixed speed types slow, slower, and dismount', () => {
    const base: RoadRuleConfig = {
      roadId: RoadType.RESIDENTIAL,
      name: 'Residential',
      baseSpeedKmh: 17,
      flatPenaltySeconds: 0,
    };
    expect(resolveRuleSpeed({ ...base, speedType: 'slow' }, 'ebike')).toBe(15);
    expect(resolveRuleSpeed({ ...base, speedType: 'slower' }, 'ebike')).toBe(10);
    expect(resolveRuleSpeed({ ...base, speedType: 'dismount' }, 'ebike')).toBe(4);
  });

  it('resolves custom speed type to baseSpeedKmh', () => {
    const cfg: RoadRuleConfig = {
      roadId: RoadType.RESIDENTIAL,
      name: 'Residential',
      baseSpeedKmh: 22,
      speedType: 'custom',
      flatPenaltySeconds: 0,
    };
    expect(resolveRuleSpeed(cfg, 'ebike')).toBe(22);
  });

  it('resolves fallback default speed types if speedType is undefined', () => {
    const signCfg: SignRuleConfig = {
      signId: InfrastructureType.SEGREGATED_PATH,
      name: 'Segregated Path',
      description: '...',
      iconCode: '🚲',
      baseSpeedKmh: 18,
      flatPenaltySeconds: 0,
    };
    expect(resolveRuleSpeed(signCfg, 'ebike')).toBe(25); // relative

    const sidewalkCfg: SignRuleConfig = {
      signId: InfrastructureType.SIDEWALK,
      name: 'Sidewalk',
      description: '...',
      iconCode: '🦶',
      baseSpeedKmh: 5,
      flatPenaltySeconds: 0,
    };
    expect(resolveRuleSpeed(sidewalkCfg, 'ebike')).toBe(4); // dismount

    const roadCfg: RoadRuleConfig = {
      roadId: RoadType.PRIMARY,
      name: 'Primary Road',
      baseSpeedKmh: 14,
      flatPenaltySeconds: 0,
    };
    expect(resolveRuleSpeed(roadCfg, 'ebike')).toBe(25); // relative
  });
});

describe('calculateTurnPenalty', () => {
  it('returns 0 for straight traversal (no turn)', () => {
    // Traverse from (0,0) to (0,1) to (0,2) - straight line north
    const p = { lat: 0.0, lng: 0.0 };
    const c = { lat: 1.0, lng: 0.0 };
    const n = { lat: 2.0, lng: 0.0 };
    expect(calculateTurnPenalty(p, c, n)).toBe(0);
  });

  it('returns 3 for normal turn (e.g., 90 degrees)', () => {
    // Traverse from (0,0) to (1,0) (going north) then to (1,1) (going east)
    const p = { lat: 0.0, lng: 0.0 };
    const c = { lat: 1.0, lng: 0.0 };
    const n = { lat: 1.0, lng: 1.0 };
    expect(calculateTurnPenalty(p, c, n)).toBe(3);
  });

  it('returns 30 for sharp U-turn', () => {
    // Traverse from (0,0) to (1,0) (going north) then back to (0,0)
    const p = { lat: 0.0, lng: 0.0 };
    const c = { lat: 1.0, lng: 0.0 };
    const n = { lat: 0.0, lng: 0.0 };
    expect(calculateTurnPenalty(p, c, n)).toBe(30);
  });
});

describe('getDefaultNodeDelay', () => {
  it('returns correct delays for various node types', () => {
    expect(getDefaultNodeDelay({ highway: 'traffic_signals' })).toBe(15);
    expect(getDefaultNodeDelay({ crossing: 'traffic_signals' })).toBe(15);
    expect(getDefaultNodeDelay({ highway: 'give_way' })).toBe(3);
    expect(getDefaultNodeDelay({ highway: 'stop' })).toBe(8);
    expect(getDefaultNodeDelay({ crossing: 'zebra' })).toBe(3);
    expect(getDefaultNodeDelay({ crossing: 'marked' })).toBe(3);
    expect(getDefaultNodeDelay({ highway: 'crossing' })).toBe(0);
    expect(getDefaultNodeDelay({ crossing: 'uncontrolled' })).toBe(0);
    expect(getDefaultNodeDelay({})).toBe(0);
  });
});

describe('calculateDisplayCost', () => {
  const nodeA: GraphNode = { id: 'A', lat: 48.137, lng: 11.575, tags: {} };
  const nodeB: GraphNode = { id: 'B', lat: 48.138, lng: 11.576, tags: {} };
  const nodeC: GraphNode = {
    id: 'C',
    lat: 48.139,
    lng: 11.577,
    tags: { highway: 'traffic_signals' },
  };

  const edgeAB: GraphEdge = {
    target: 'B',
    distance: 120,
    name: 'Street AB',
    tags: { highway: 'cycleway' },
  };
  const edgeBC: GraphEdge = {
    target: 'C',
    distance: 180,
    name: 'Street BC',
    tags: { highway: 'primary' },
  };

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

    const edgeAB: GraphEdge = {
      target: 'B',
      distance: 180,
      name: 'Street AB',
      tags: { highway: 'cycleway' },
    };
    const edgeBA: GraphEdge = {
      target: 'A',
      distance: 180,
      name: 'Street AB',
      tags: { highway: 'cycleway' },
    };
    const edgeBC: GraphEdge = {
      target: 'C',
      distance: 180,
      name: 'Street BC',
      tags: { highway: 'cycleway' },
    };
    const edgeCB: GraphEdge = {
      target: 'B',
      distance: 180,
      name: 'Street BC',
      tags: { highway: 'cycleway' },
    };
    const edgeAC: GraphEdge = {
      target: 'C',
      distance: 100,
      name: 'Street AC',
      tags: { highway: 'pedestrian' },
    };
    const edgeCA: GraphEdge = {
      target: 'A',
      distance: 100,
      name: 'Street AC',
      tags: { highway: 'pedestrian' },
    };

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
      { nodeDelays: new Map(), nodeNotes: new Map(), nodeTurns: new Map() },
    );

    expect(result).not.toBeNull();
    // Path should start at virtual-start and end at virtual-end, containing B
    expect(result!.pathNodeIds[0]).toBe('virtual-start');
    expect(result!.pathNodeIds[result!.pathNodeIds.length - 1]).toBe('virtual-end');
    expect(result!.pathNodeIds).toContain('B');
    // totalDurationSeconds should be the display cost (~52.3s), not the routing cost
    expect(result!.totalDurationSeconds).toBeCloseTo(52.3, 1);
  });

  it('correctly counts signals, yields, and crossings along the route', () => {
    const nodeA: GraphNode = { id: 'A', lat: 48.137, lng: 11.575, tags: {} };
    const nodeB: GraphNode = {
      id: 'B',
      lat: 48.138,
      lng: 11.576,
      tags: { highway: 'traffic_signals' },
    };
    const nodeC: GraphNode = { id: 'C', lat: 48.139, lng: 11.577, tags: { highway: 'give_way' } };
    const nodeD: GraphNode = {
      id: 'D',
      lat: 48.14,
      lng: 11.578,
      tags: { highway: 'crossing', crossing: 'zebra' },
    };

    const edgeAB: GraphEdge = {
      target: 'B',
      distance: 100,
      name: 'Street AB',
      tags: { highway: 'cycleway' },
    };
    const edgeBA: GraphEdge = {
      target: 'A',
      distance: 100,
      name: 'Street AB',
      tags: { highway: 'cycleway' },
    };
    const edgeBC: GraphEdge = {
      target: 'C',
      distance: 100,
      name: 'Street BC',
      tags: { highway: 'cycleway' },
    };
    const edgeCB: GraphEdge = {
      target: 'B',
      distance: 100,
      name: 'Street BC',
      tags: { highway: 'cycleway' },
    };
    const edgeCD: GraphEdge = {
      target: 'D',
      distance: 100,
      name: 'Street CD',
      tags: { highway: 'cycleway' },
    };
    const edgeDC: GraphEdge = {
      target: 'C',
      distance: 100,
      name: 'Street CD',
      tags: { highway: 'cycleway' },
    };

    const graph: StreetGraph = {
      nodes: new Map([
        ['A', { node: nodeA, edges: [edgeAB] }],
        ['B', { node: nodeB, edges: [edgeBC, edgeBA] }],
        ['C', { node: nodeC, edges: [edgeCD, edgeCB] }],
        ['D', { node: nodeD, edges: [edgeDC] }],
      ]),
    };

    const router = new DijkstraRouter();
    const result = router.findRoute(
      graph,
      { lat: nodeA.lat, lng: nodeA.lng },
      { lat: nodeD.lat, lng: nodeD.lng },
      standardCost,
      { nodeDelays: new Map(), nodeNotes: new Map(), nodeTurns: new Map() },
    );

    expect(result).not.toBeNull();
    expect(result!.signalCount).toBe(1);
    expect(result!.yieldCount).toBe(1);
    expect(result!.crossingCount).toBe(1);
  });

  it('correctly aggregates road type totals', () => {
    const nodeA: GraphNode = { id: 'A', lat: 48.137, lng: 11.575, tags: {} };
    const nodeB: GraphNode = { id: 'B', lat: 48.138, lng: 11.576, tags: {} };
    const nodeC: GraphNode = { id: 'C', lat: 48.139, lng: 11.577, tags: {} };

    const edgeAB: GraphEdge = {
      target: 'B',
      distance: 150,
      name: 'Street AB',
      tags: { highway: 'cycleway' },
    };
    const edgeBA: GraphEdge = {
      target: 'A',
      distance: 150,
      name: 'Street AB',
      tags: { highway: 'cycleway' },
    };
    const edgeBC: GraphEdge = {
      target: 'C',
      distance: 250,
      name: 'Street BC',
      tags: { highway: 'primary' },
    };
    const edgeCB: GraphEdge = {
      target: 'B',
      distance: 250,
      name: 'Street BC',
      tags: { highway: 'primary' },
    };

    const graph: StreetGraph = {
      nodes: new Map([
        ['A', { node: nodeA, edges: [edgeAB] }],
        ['B', { node: nodeB, edges: [edgeBC, edgeBA] }],
        ['C', { node: nodeC, edges: [edgeCB] }],
      ]),
    };

    const router = new DijkstraRouter();
    const result = router.findRoute(
      graph,
      { lat: nodeA.lat, lng: nodeA.lng },
      { lat: nodeC.lat, lng: nodeC.lng },
      standardCost,
      { nodeDelays: new Map(), nodeNotes: new Map(), nodeTurns: new Map() },
    );

    expect(result).not.toBeNull();
    expect(result!.roadTypeTotals).toBeDefined();
    expect(result!.roadTypeTotals.cycleway).toBeGreaterThan(0);
    expect(result!.roadTypeTotals.primary).toBeGreaterThan(0);
  });

  it('aggregates roads with cycleway tags or designated bicycle tags as cycleway in roadTypeTotals', () => {
    const nodeA: GraphNode = { id: 'A', lat: 48.137, lng: 11.575, tags: {} };
    const nodeB: GraphNode = { id: 'B', lat: 48.138, lng: 11.576, tags: {} };
    const nodeC: GraphNode = { id: 'C', lat: 48.139, lng: 11.577, tags: {} };

    const edgeAB: GraphEdge = {
      target: 'B',
      distance: 150,
      name: 'Street AB',
      tags: { highway: 'primary', 'cycleway:left': 'track' },
    };
    const edgeBA: GraphEdge = {
      target: 'A',
      distance: 150,
      name: 'Street AB',
      tags: { highway: 'primary', 'cycleway:left': 'track' },
    };
    const edgeBC: GraphEdge = {
      target: 'C',
      distance: 250,
      name: 'Street BC',
      tags: { highway: 'path', bicycle: 'designated' },
    };
    const edgeCB: GraphEdge = {
      target: 'B',
      distance: 250,
      name: 'Street BC',
      tags: { highway: 'path', bicycle: 'designated' },
    };

    const graph: StreetGraph = {
      nodes: new Map([
        ['A', { node: nodeA, edges: [edgeAB] }],
        ['B', { node: nodeB, edges: [edgeBC, edgeBA] }],
        ['C', { node: nodeC, edges: [edgeCB] }],
      ]),
    };

    const router = new DijkstraRouter();
    const result = router.findRoute(
      graph,
      { lat: nodeA.lat, lng: nodeA.lng },
      { lat: nodeC.lat, lng: nodeC.lng },
      standardCost,
      { nodeDelays: new Map(), nodeNotes: new Map(), nodeTurns: new Map() },
    );

    expect(result).not.toBeNull();
    expect(result!.roadTypeTotals).toBeDefined();
    expect(result!.roadTypeTotals.cycleway).toBeCloseTo(267.4, 1);
    expect(result!.roadTypeTotals.primary || 0).toBe(0);
  });
});

describe('avoidBusyRoadsCost', () => {
  const nodeA: GraphNode = { id: 'A', lat: 48.137, lng: 11.575, tags: {} };
  const nodeB: GraphNode = { id: 'B', lat: 48.138, lng: 11.576, tags: {} };
  const graph: StreetGraph = {
    nodes: new Map([
      ['A', { node: nodeA, edges: [] }],
      ['B', { node: nodeB, edges: [] }],
    ]),
  };

  it('applies default fallback comfort multipliers when rules are absent', () => {
    // Primary road with no cycleway has comfort 'very_low' -> multiplier 4.0
    const edgePrimary: GraphEdge = {
      target: 'B',
      distance: 100,
      name: 'Primary',
      tags: { highway: 'primary' },
    };
    const overrides: LocalOverrides = {
      nodeDelays: new Map(),
      nodeNotes: new Map(),
      nodeTurns: new Map(),
    };

    const cost = avoidBusyRoadsCost('A', edgePrimary, 'B', overrides, graph);
    // Base time on primary (speed = 4.0 m/s): 100 / 4 = 25s
    // Multiplied by 4.0 comfort penalty: 25 * 4 = 100s
    expect(cost).toBeCloseTo(100, 1);
  });

  it('respects custom rulesConfig comfort levels', () => {
    const edgePrimary: GraphEdge = {
      target: 'B',
      distance: 100,
      name: 'Primary',
      tags: { highway: 'primary' },
    };
    const overrides: LocalOverrides = {
      nodeDelays: new Map(),
      nodeNotes: new Map(),
      nodeTurns: new Map(),
      rulesConfig: {
        signs: {} as Record<InfrastructureType, SignRuleConfig>,
        roads: {
          [RoadType.PRIMARY]: {
            roadId: RoadType.PRIMARY,
            name: 'Primary',
            baseSpeedKmh: 14.4, // 4.0 m/s
            speedType: 'custom',
            flatPenaltySeconds: 0,
            comfort: 'high', // Should map to 0.8 multiplier
          },
        } as unknown as Record<RoadType, RoadRuleConfig>,
        nodeDelays: {} as NodeDelayConfig,
      },
    };

    const cost = avoidBusyRoadsCost('A', edgePrimary, 'B', overrides, graph);
    // Base time: 100 / 4 = 25s
    // Multiplied by 0.8: 25 * 0.8 = 20s
    expect(cost).toBeCloseTo(20, 1);
  });

  it('overrides low/very_low comfort to high for roads with cycleways', () => {
    // Primary road WITH cycleway tags
    const edgePrimaryCycleway: GraphEdge = {
      target: 'B',
      distance: 100,
      name: 'Primary',
      tags: { highway: 'primary', 'cycleway:left': 'track' },
    };
    const overrides: LocalOverrides = {
      nodeDelays: new Map(),
      nodeNotes: new Map(),
      nodeTurns: new Map(),
      rulesConfig: {
        signs: {} as Record<InfrastructureType, SignRuleConfig>,
        roads: {
          [RoadType.PRIMARY]: {
            roadId: RoadType.PRIMARY,
            name: 'Primary',
            baseSpeedKmh: 14.4, // 4.0 m/s
            speedType: 'custom',
            flatPenaltySeconds: 0,
            comfort: 'very_low', // normally 4.0, but overridden to 'high' (0.8) due to cycleway
          },
        } as unknown as Record<RoadType, RoadRuleConfig>,
        nodeDelays: {} as NodeDelayConfig,
      },
    };

    const cost = avoidBusyRoadsCost('A', edgePrimaryCycleway, 'B', overrides, graph);
    // Base time: 100 / 4 = 25s
    // Multiplied by 0.8: 25 * 0.8 = 20s
    expect(cost).toBeCloseTo(20, 1);
  });
});
