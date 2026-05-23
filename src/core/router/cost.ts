import type { CostFunction, GraphEdge, LocalOverrides, StreetGraph, BikeProfile, SignRuleConfig, RoadRuleConfig } from '../types';
import { mapOSMToSignAndRoad, mapOSMNodeToControl } from './rules';

// ─── Speed helpers ────────────────────────────────────────────────────────────

/**
 * Converts km/h to m/s.
 */
function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

/**
 * Speed multiplier per bike profile relative to a "normal" 18 km/h baseline.
 * slow  = 15 km/h, normal = 18 km/h, ebike = 25 km/h.
 */
const PROFILE_MULTIPLIER: Record<string, number> = {
  slow:   15 / 18,  // ~0.833
  normal: 1.0,
  ebike:  25 / 18,  // ~1.389
};

/**
 * Resolves a SignRuleConfig or RoadRuleConfig speed to km/h based on the speedType and bike profile,
 * obeying require dismount constraint (4 km/h) if active.
 */
export function resolveRuleSpeed(
  cfg: SignRuleConfig | RoadRuleConfig,
  profile: BikeProfile
): number {
  // If require dismount is true (on SignRuleConfig), lock to 4 km/h
  if ('dismountRequired' in cfg && cfg.dismountRequired) {
    return 4;
  }

  let speedType = cfg.speedType;
  if (!speedType) {
    if ('signId' in cfg) {
      const signId = cfg.signId;
      if (signId === 'Vz_241' || signId === 'Vz_244.1') {
        speedType = 'relative';
      } else if (signId === 'Vz_242.1' || signId === 'Vz_239') {
        speedType = 'dismount';
      } else {
        speedType = 'custom';
      }
    } else {
      speedType = 'relative';
    }
  }

  switch (speedType) {
    case 'relative':
      if (profile === 'slow') return 15;
      if (profile === 'ebike') return 25;
      return 18; // normal
    case 'slow':
      return 15;
    case 'slower':
      return 10;
    case 'dismount':
      return 5;
    case 'custom':
    default:
      return cfg.baseSpeedKmh;
  }
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
  const profile = overrides.bikeProfile ?? 'normal';
  const profileMultiplier = PROFILE_MULTIPLIER[profile] ?? 1.0;

  let speed: number;
  let flatPenalty: number;

  if (rules) {
    if (sign && rules.signs[sign]) {
      const cfg = rules.signs[sign];
      const speedKmh = resolveRuleSpeed(cfg, profile);
      speed = kmhToMs(speedKmh);
      flatPenalty = cfg.flatPenaltySeconds;
      return { speed, flatPenalty, bicycleFrei };
    } else if (rules.roads[road]) {
      const cfg = rules.roads[road];
      const speedKmh = resolveRuleSpeed(cfg, profile);
      speed = kmhToMs(speedKmh);
      flatPenalty = cfg.flatPenaltySeconds;
      return { speed, flatPenalty, bicycleFrei };
    } else {
      speed = kmhToMs(18) * profileMultiplier;
      flatPenalty = 0;
      return { speed, flatPenalty, bicycleFrei };
    }
  } else {
    // ── Hardcoded fallback ───────────────────────────────────────────────────
    const cycleway = edge.tags.cycleway || edge.tags['cycleway:left'] || edge.tags['cycleway:right'];
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
    } else {
      speed = 5.0;
    }
    flatPenalty = 0;
    return { speed: speed * profileMultiplier, flatPenalty, bicycleFrei };
  }
}

/**
 * Resolves the default wait penalty (in seconds) for a control point node.
 */
export function getDefaultNodeDelay(tags: Record<string, string>): number {
  const controlType = mapOSMNodeToControl(tags);
  if (controlType === 'signal') {
    return 15; // default traffic light wait
  }
  if (controlType === 'yield') {
    return 3;  // default yield delay
  }
  if (controlType === 'stop') {
    return 8;  // default stop delay
  }
  if (controlType === 'crossing') {
    return 3;  // default pedestrian crossing delay
  }
  return 0;
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

  // Custom node delay or default control point penalty
  const customDelay = overrides.nodeDelays.get(targetId);
  if (customDelay !== undefined) {
    cost += customDelay;
  } else {
    const targetNode = graph.nodes.get(targetId)?.node;
    const tags = targetNode?.tags || {};
    cost += getDefaultNodeDelay(tags);
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
    const defaultDelay = getDefaultNodeDelay(tags);
    if (defaultDelay > 0) {
      // Scale standard delay and add heavy stop avoidance penalty (45s base for signals/stops, 25s for yields/crossings)
      const controlType = mapOSMNodeToControl(tags);
      const baseStopPenalty = (controlType === 'signal' || controlType === 'stop') ? 45 : 25;
      cost += defaultDelay + baseStopPenalty;
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

/**
 * Calculates the real-world travel time (display cost) in seconds for an edge.
 * This is pure physical estimation: Time = Distance / Speed + node delays.
 * Consistent across all routing strategies.
 */
export function calculateDisplayCost(
  _sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph
): number {
  const { speed, flatPenalty } = resolveSpeedAndPenalty(edge, overrides);
  
  let cost = edge.distance / speed + flatPenalty;

  // Add node delay
  const customDelay = overrides.nodeDelays.get(targetId);
  if (customDelay !== undefined) {
    cost += customDelay;
  } else {
    const targetNode = graph.nodes.get(targetId)?.node;
    const tags = targetNode?.tags || {};
    cost += getDefaultNodeDelay(tags);
  }

  return cost;
}
