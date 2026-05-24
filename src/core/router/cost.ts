import type { GraphEdge, StreetGraph } from '../graph/types';
import type { BikeProfile, LocalOverrides } from '../storage/types';
import { hasCycleway, mapOSMNodeToControl, mapOSMToSignAndRoad } from './rules';
import type {
  ComfortLevel,
  CostFunction,
  NodeDelayConfig,
  RoadRuleConfig,
  SignRuleConfig,
} from './types';

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
  slow: 15 / 18, // ~0.833
  normal: 1.0,
  ebike: 25 / 18, // ~1.389
};

/**
 * Resolves a SignRuleConfig or RoadRuleConfig speed to km/h based on the speedType and bike profile,
 * resolved based on the speedType and bike profile.
 */
export function resolveRuleSpeed(
  cfg: SignRuleConfig | RoadRuleConfig,
  profile: BikeProfile,
): number {
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
      return 4; // lock walking speed to 4 km/h
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
  overrides: LocalOverrides,
): { speed: number; flatPenalty: number; bicycleFrei: boolean } {
  const highway = edge.tags.highway || '';
  const { sign, road, bicycleFrei } = mapOSMToSignAndRoad(highway, edge.tags);
  const rules = overrides.rulesConfig;
  const profile = overrides.bikeProfile ?? 'normal';
  const profileMultiplier = PROFILE_MULTIPLIER[profile] ?? 1.0;

  let speed: number;
  let flatPenalty: number;

  if (rules) {
    if (sign && rules.signs && rules.signs[sign]) {
      const cfg = rules.signs[sign];
      const speedKmh = resolveRuleSpeed(cfg, profile);
      speed = kmhToMs(speedKmh);
      flatPenalty = cfg.flatPenaltySeconds;
      return { speed, flatPenalty, bicycleFrei };
    } else if (rules.roads && rules.roads[road]) {
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
    if (hasCycleway(edge.tags)) {
      speed = 5.5;
    } else if (highway === 'cycleway') {
      speed = 6.0;
    } else if (['footway', 'pedestrian', 'path'].includes(highway)) {
      speed = bicycleFrei ? 4.5 : 1.2;
    } else if (highway === 'service') {
      speed = edge.tags.service === 'parking_aisle' || edge.tags.service === 'driveway' ? 1.5 : 3.0;
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
/**
 * Returns the default wait penalty (seconds) for a node, based on its OSM control type.
 * Respects configured delays from rulesConfig when provided.
 */
export function getDefaultNodeDelay(tags: Record<string, string>, cfg?: NodeDelayConfig): number {
  const controlType = mapOSMNodeToControl(tags);
  if (controlType === 'signal') return cfg?.signalSeconds ?? 15;
  if (controlType === 'yield') return cfg?.yieldSeconds ?? 3;
  if (controlType === 'stop') return cfg?.stopSeconds ?? 8;
  if (controlType === 'crossing') return cfg?.crossingSeconds ?? 3;
  return 0;
}

// ─── Cost functions ───────────────────────────────────────────────────────────

/**
 * Applies a heavy penalty if the path is a footway/pedestrian/path and does not allow bicycles.
 *
 * @param cost - The base cost before path restriction evaluation.
 * @param highway - The highway classification.
 * @param bicycleFrei - Boolean indicating if bicycle travel is allowed.
 * @returns The cost after applying the restriction penalty if applicable.
 */
function applyRestrictedPathPenalty(cost: number, highway: string, bicycleFrei: boolean): number {
  if (['footway', 'pedestrian', 'path'].includes(highway) && !bicycleFrei) {
    return (cost + 60) * 4.0;
  }
  return cost;
}

/**
 * Standard routing cost: Time = Distance / Speed + flat penalties.
 * Uses rulesConfig when available for dynamic speed and penalty resolution.
 */
export const standardCost: CostFunction = (
  _sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph,
): number => {
  const { speed, flatPenalty, bicycleFrei } = resolveSpeedAndPenalty(edge, overrides);
  const highway = edge.tags.highway || '';

  let cost = edge.distance / speed + flatPenalty;

  // Heavy penalty for paths that don't allow bicycles (overrides cannot override physics)
  cost = applyRestrictedPathPenalty(cost, highway, bicycleFrei);

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
    cost += getDefaultNodeDelay(tags, overrides.rulesConfig?.nodeDelays);
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
  graph: StreetGraph,
): number => {
  const { speed, flatPenalty, bicycleFrei } = resolveSpeedAndPenalty(edge, overrides);
  const highway = edge.tags.highway || '';

  let cost = edge.distance / speed + flatPenalty;

  cost = applyRestrictedPathPenalty(cost, highway, bicycleFrei);

  const customDelay = overrides.nodeDelays.get(targetId);
  if (customDelay !== undefined) {
    cost += customDelay + 10; // Extra stopping fatigue penalty
  } else {
    const targetNode = graph.nodes.get(targetId)?.node;
    const tags = targetNode?.tags || {};
    const defaultDelay = getDefaultNodeDelay(tags, overrides.rulesConfig?.nodeDelays);
    if (defaultDelay > 0) {
      // Scale standard delay and add heavy stop avoidance penalty (45s base for signals/stops, 25s for yields/crossings)
      const controlType = mapOSMNodeToControl(tags);
      const baseStopPenalty = controlType === 'signal' || controlType === 'stop' ? 45 : 25;
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
  graph: StreetGraph,
): number => {
  const baseCost = standardCost(sourceId, edge, targetId, overrides, graph);
  const highway = edge.tags.highway || '';
  const isCycleway = hasCycleway(edge.tags);

  let comfort: ComfortLevel = 'neutral';

  const rules = overrides.rulesConfig;
  if (rules) {
    const { sign, road } = mapOSMToSignAndRoad(highway, edge.tags);
    if (sign && rules.signs && rules.signs[sign]) {
      comfort = rules.signs[sign].comfort || 'neutral';
    } else if (rules.roads && rules.roads[road]) {
      comfort = rules.roads[road].comfort || 'neutral';
    }
  } else {
    // Hardcoded fallback logic
    if (highway === 'cycleway') {
      comfort = 'very_high';
    } else if (['footway', 'pedestrian', 'path'].includes(highway)) {
      comfort = 'high';
    } else if (['primary', 'primary_link'].includes(highway)) {
      comfort = isCycleway ? 'neutral' : 'very_low';
    } else if (['secondary', 'secondary_link'].includes(highway)) {
      comfort = isCycleway ? 'neutral' : 'low';
    } else if (['tertiary', 'tertiary_link'].includes(highway)) {
      comfort = isCycleway ? 'high' : 'low';
    } else if (highway === 'residential' || highway === 'living_street') {
      comfort = 'high';
    }
  }

  // Override: If a major road has a cycleway, treat its comfort as 'high' by default
  // because cycling lanes on asphalt are fine for comfort.
  if (isCycleway && ['very_low', 'low', 'neutral'].includes(comfort)) {
    comfort = 'high';
  }

  // Map ComfortLevel to cost multipliers
  const COMFORT_MULTIPLIERS: Record<ComfortLevel, number> = {
    very_low: 4.0,
    low: 2.0,
    neutral: 1.0,
    high: 0.8,
    very_high: 0.6,
  };

  const multiplier = COMFORT_MULTIPLIERS[comfort] ?? 1.0;
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
  graph: StreetGraph,
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
    cost += getDefaultNodeDelay(tags, overrides.rulesConfig?.nodeDelays);
  }

  return cost;
}
