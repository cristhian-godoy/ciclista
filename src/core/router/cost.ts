import type { CostFunction, GraphEdge, LocalOverrides, StreetGraph } from '../types';

/**
 * Helper to estimate average speed on a street segment based on type and tags.
 */
function getBaseSpeed(edge: GraphEdge): number {
  const highway = edge.tags.highway;
  const cycleway = edge.tags.cycleway || edge.tags['cycleway:left'] || edge.tags['cycleway:right'];

  // Base speed in m/s (5.0 m/s = 18 km/h)
  let speed = 5.0;

  if (cycleway) {
    speed = 5.5; // Slightly faster on dedicated bike infrastructure
  } else if (highway === 'cycleway') {
    speed = 6.0; // Fast dedicated paths
  } else if (highway === 'primary') {
    speed = 4.0; // Slower due to congestion / traffic interaction
  } else if (highway === 'secondary') {
    speed = 4.5;
  } else if (highway === 'residential') {
    speed = 4.8;
  } else if (highway === 'living_street') {
    speed = 4.0; // Slow due to pedestrians
  }

  return speed;
}

/**
 * Standard routing cost: Time = Distance / Speed.
 * Adds default penalties for physical traffic signals.
 */
export const standardCost: CostFunction = (
  _sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph
): number => {
  const speed = getBaseSpeed(edge);
  let cost = edge.distance / speed; // Travel time in seconds

  // Add custom delays if user timed it
  const customDelay = overrides.nodeDelays.get(targetId);
  if (customDelay !== undefined) {
    cost += customDelay;
  } else {
    // Fallback: Default penalty for untimed OSM traffic signals
    const targetNode = graph.nodes.get(targetId)?.node;
    const tags = targetNode?.tags || {};
    if (
      tags.highway === 'traffic_signals' ||
      tags.crossing === 'traffic_signals' ||
      tags.crossing === 'controlled'
    ) {
      cost += 15; // 15-second default signal stop
    }
  }

  return cost;
};

/**
 * Stop-avoidance routing cost:
 * Puts very high penalties on stops (traffic lights and crossings) to maximize rolling continuity.
 */
export const avoidStoppingCost: CostFunction = (
  _sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph
): number => {
  const speed = getBaseSpeed(edge);
  let cost = edge.distance / speed;

  const customDelay = overrides.nodeDelays.get(targetId);
  if (customDelay !== undefined) {
    // If timed, use actual delay + additional penalty for the physical act of stopping (braking/acceleration)
    cost += customDelay + 10; // Extra 10s penalty for stopping fatigue
  } else {
    // If not explicitly timed but marked as a signal/crossing/stop, add a heavy penalty
    const targetNode = graph.nodes.get(targetId)?.node;
    const tags = targetNode?.tags || {};
    if (
      tags.highway === 'traffic_signals' ||
      tags.crossing === 'traffic_signals' ||
      tags.crossing === 'controlled' ||
      tags.highway === 'stop'
    ) {
      cost += 45; // Heavy 45s default penalty to route away from signals/stops
    }
  }

  return cost;
};

/**
 * Quiet/Convenient routing cost:
 * Strongly avoids primary and secondary roads, prioritizing cycling tracks and residential streets.
 */
export const avoidBusyRoadsCost: CostFunction = (
  sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph
): number => {
  const baseCost = standardCost(sourceId, edge, targetId, overrides, graph);
  const highway = edge.tags.highway;
  const cycleway = edge.tags.cycleway || edge.tags['cycleway:left'] || edge.tags['cycleway:right'];

  let multiplier = 1.0;

  if (['primary', 'primary_link'].includes(highway || '')) {
    multiplier = cycleway ? 1.5 : 3.0; // Avoid primary streets (3x penalty unless there is a cycle track)
  } else if (['secondary', 'secondary_link'].includes(highway || '')) {
    multiplier = cycleway ? 1.2 : 2.0;
  } else if (highway === 'cycleway') {
    multiplier = 0.8; // Favor dedicated cycling paths (20% discount)
  }

  return baseCost * multiplier;
};
