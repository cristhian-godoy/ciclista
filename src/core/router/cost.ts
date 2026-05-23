import type { CostFunction, GraphEdge, LocalOverrides, StreetGraph } from '../types';
import { mapOSMToSignAndRoad } from './rules';

// ─── Speed helpers ────────────────────────────────────────────────────────────

/**
 * Converts km/h to m/s.
 */
function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

/**
 * Resolves the effective cycling speed (m/s) and flat penalty (s) for an edge,
 * using the active RulesConfiguration when available, falling back to hardcoded defaults.
 */
function resolveSpeedAndPenalty(
  edge: GraphEdge,
  overrides: LocalOverrides
): { speed: number; flatPenalty: number; bicycleFrei: boolean } {
  const highway = edge.tags.highway || '';
  const { sign, road, bicycleFrei } = mapOSMToSignAndRoad(highway, edge.tags);
  const rules = overrides.rulesConfig;

  if (rules) {
    // Sign config takes priority over road config when a sign is matched
    if (sign && rules.signs[sign]) {
      const cfg = rules.signs[sign];
      return {
        speed: kmhToMs(cfg.baseSpeedKmh),
        flatPenalty: cfg.flatPenaltySeconds,
        bicycleFrei,
      };
    }
    // Fall back to road classification config
    if (rules.roads[road]) {
      const cfg = rules.roads[road];
      return {
        speed: kmhToMs(cfg.baseSpeedKmh),
        flatPenalty: cfg.flatPenaltySeconds,
        bicycleFrei,
      };
    }
  }

  // ── Hardcoded fallback (no rulesConfig present) ────────────────────────────
  const cycleway = edge.tags.cycleway || edge.tags['cycleway:left'] || edge.tags['cycleway:right'];
  let speed = 5.0; // 18 km/h default
  if (cycleway) {
    speed = 5.5;
  } else if (highway === 'cycleway') {
    speed = 6.0;
  } else if (['footway', 'pedestrian', 'path'].includes(highway)) {
    speed = bicycleFrei ? 4.5 : 1.2;
  } else if (highway === 'service') {
    speed = (edge.tags.service === 'parking_aisle' || edge.tags.service === 'driveway') ? 1.5 : 3.0;
  } else if (highway === 'primary') {
    speed = 4.0;
  } else if (highway === 'secondary') {
    speed = 4.5;
  } else if (highway === 'residential') {
    speed = 4.8;
  } else if (highway === 'living_street') {
    speed = 4.0;
  }
  return { speed, flatPenalty: 0, bicycleFrei };
}

// ─── Cost functions ───────────────────────────────────────────────────────────

/**
 * Standard routing cost: Time = Distance / Speed + flat penalties.
 * Uses rulesConfig when available for dynamic speed and penalty resolution.
 */
export const standardCost: CostFunction = (
  _sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph
): number => {
  const { speed, flatPenalty, bicycleFrei } = resolveSpeedAndPenalty(edge, overrides);
  const highway = edge.tags.highway || '';

  let cost = edge.distance / speed + flatPenalty;

  // Heavy penalty for paths that don't allow bicycles (overrides cannot override physics)
  if (['footway', 'pedestrian', 'path'].includes(highway) && !bicycleFrei) {
    cost += 60;
    cost *= 4.0;
  }

  // Service road penalties
  if (highway === 'service') {
    if (edge.tags.service === 'parking_aisle' || edge.tags.service === 'driveway') {
      cost += 30;
      cost *= 2.5;
    } else {
      cost += 5;
      cost *= 1.2;
    }
  }

  // Custom node delay or default signal penalty
  const customDelay = overrides.nodeDelays.get(targetId);
  if (customDelay !== undefined) {
    cost += customDelay;
  } else {
    const targetNode = graph.nodes.get(targetId)?.node;
    const tags = targetNode?.tags || {};
    if (
      tags.highway === 'traffic_signals' ||
      tags.crossing === 'traffic_signals' ||
      tags.crossing === 'controlled'
    ) {
      cost += 15;
    }
  }

  return cost;
};

/**
 * Stop-avoidance routing cost.
 * Uses rulesConfig for speeds; adds heavy stop penalties.
 */
export const avoidStoppingCost: CostFunction = (
  _sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph
): number => {
  const { speed, flatPenalty, bicycleFrei } = resolveSpeedAndPenalty(edge, overrides);
  const highway = edge.tags.highway || '';

  let cost = edge.distance / speed + flatPenalty;

  if (['footway', 'pedestrian', 'path'].includes(highway) && !bicycleFrei) {
    cost += 60;
    cost *= 4.0;
  }

  const customDelay = overrides.nodeDelays.get(targetId);
  if (customDelay !== undefined) {
    cost += customDelay + 10; // Extra stopping fatigue penalty
  } else {
    const targetNode = graph.nodes.get(targetId)?.node;
    const tags = targetNode?.tags || {};
    if (
      tags.highway === 'traffic_signals' ||
      tags.crossing === 'traffic_signals' ||
      tags.crossing === 'controlled' ||
      tags.highway === 'stop'
    ) {
      cost += 45;
    }
  }

  return cost;
};

/**
 * Quiet/convenient routing cost.
 * Uses rulesConfig for base costs; multiplies busy roads.
 */
export const avoidBusyRoadsCost: CostFunction = (
  sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph
): number => {
  const baseCost = standardCost(sourceId, edge, targetId, overrides, graph);
  const highway = edge.tags.highway || '';
  const cycleway = edge.tags.cycleway || edge.tags['cycleway:left'] || edge.tags['cycleway:right'];

  let multiplier = 1.0;
  if (['primary', 'primary_link'].includes(highway)) {
    multiplier = cycleway ? 1.5 : 3.0;
  } else if (['secondary', 'secondary_link'].includes(highway)) {
    multiplier = cycleway ? 1.2 : 2.0;
  } else if (highway === 'cycleway') {
    multiplier = 0.8;
  }

  return baseCost * multiplier;
};
