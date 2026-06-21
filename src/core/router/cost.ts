import type { GraphEdge, StreetGraph } from '../graph/types';
import type { LocalOverrides } from '../storage/types';
import { mapBikeConfigToImpacts } from './bike';
import { getSurfaceType, hasCycleway, mapOSMNodeToControl, mapOSMToSignAndRoad } from './rules';
import { mapRoadConfigToImpacts, mapSignConfigToImpacts } from './rules-impacts';
import type {
  AlternativeEdgeEvaluation,
  ComfortLevel,
  CostFunction,
  NodeDelayConfig,
} from './types';

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
  overrides: LocalOverrides,
): { speed: number; flatPenalty: number; bicycleFrei: boolean } {
  const highway = edge.tags.highway || '';
  const { sign, road, bicycleFrei } = mapOSMToSignAndRoad(highway, edge.tags);
  const rules = overrides.rulesConfig;
  const config = overrides.bikeConfig ?? { id: 'normal' };
  const impacts = mapBikeConfigToImpacts(config);

  let speed: number;
  let flatPenalty: number;

  if (rules) {
    const signImpacts = mapSignConfigToImpacts(rules.signs, impacts.cruisingSpeedKmh);
    const roadImpacts = mapRoadConfigToImpacts(rules.roads, impacts.cruisingSpeedKmh);

    if (sign && signImpacts[sign]) {
      const impact = signImpacts[sign];
      speed = impact.effectiveSpeedMs;
      flatPenalty = impact.flatPenaltySeconds;
    } else if (roadImpacts[road]) {
      const impact = roadImpacts[road];
      speed = impact.effectiveSpeedMs;
      flatPenalty = impact.flatPenaltySeconds;
    } else {
      speed = kmhToMs(impacts.cruisingSpeedKmh);
      flatPenalty = 0;
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
    speed = speed * (impacts.cruisingSpeedKmh / 18.0);
    flatPenalty = 0;
  }

  // ── Apply Surface Penalties ────────────────────────────────────────────────
  const surfaceType = getSurfaceType(edge.tags);
  if (surfaceType === 'gravel') {
    speed *= impacts.surfaceModifiers.gravel.speedMultiplier;
    flatPenalty += impacts.surfaceModifiers.gravel.flatPenalty;
  } else if (surfaceType === 'cobblestone') {
    speed *= impacts.surfaceModifiers.cobblestone.speedMultiplier;
    flatPenalty += impacts.surfaceModifiers.cobblestone.flatPenalty;
  }

  return { speed, flatPenalty, bicycleFrei };
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
    const config = overrides.bikeConfig ?? { id: 'normal' };
    const bikeImpacts = mapBikeConfigToImpacts(config);
    const signImpacts = mapSignConfigToImpacts(rules.signs, bikeImpacts.cruisingSpeedKmh);
    const roadImpacts = mapRoadConfigToImpacts(rules.roads, bikeImpacts.cruisingSpeedKmh);
    const { sign, road } = mapOSMToSignAndRoad(highway, edge.tags);
    if (sign && signImpacts[sign]) {
      comfort = signImpacts[sign].comfort;
    } else if (roadImpacts[road]) {
      comfort = roadImpacts[road].comfort;
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

/**
 * Cohesive, stateless utility function that calculates the detailed impact breakdown for any generic edge.
 */
export function evaluateEdge(
  sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph,
  costFn?: CostFunction,
  turnPenalty?: number,
): AlternativeEdgeEvaluation {
  const {
    speed: effectiveSpeedMs,
    flatPenalty,
    bicycleFrei,
  } = resolveSpeedAndPenalty(edge, overrides);
  const highway = edge.tags.highway || '';
  const { sign, road } = mapOSMToSignAndRoad(highway, edge.tags);
  const isCycleway = hasCycleway(edge.tags);

  const config = overrides.bikeConfig ?? { id: 'normal' };
  const impacts = mapBikeConfigToImpacts(config);

  const surfaceType = getSurfaceType(edge.tags);
  let baseSpeedMs = effectiveSpeedMs;
  if (surfaceType === 'gravel') {
    baseSpeedMs /= impacts.surfaceModifiers.gravel.speedMultiplier;
  } else if (surfaceType === 'cobblestone') {
    baseSpeedMs /= impacts.surfaceModifiers.cobblestone.speedMultiplier;
  }

  const baseSpeedKmh = baseSpeedMs * 3.6;
  const effectiveSpeedKmh = effectiveSpeedMs * 3.6;

  // Resolve Comfort Level
  let comfort: ComfortLevel = 'neutral';
  const rules = overrides.rulesConfig;
  if (rules) {
    const signImpacts = mapSignConfigToImpacts(rules.signs, impacts.cruisingSpeedKmh);
    const roadImpacts = mapRoadConfigToImpacts(rules.roads, impacts.cruisingSpeedKmh);
    if (sign && signImpacts[sign]) {
      comfort = signImpacts[sign].comfort;
    } else if (roadImpacts[road]) {
      comfort = roadImpacts[road].comfort;
    }
  } else {
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

  if (isCycleway && ['very_low', 'low', 'neutral'].includes(comfort)) {
    comfort = 'high';
  }

  const isRestricted = ['footway', 'pedestrian', 'path'].includes(highway) && !bicycleFrei;
  const restrictionReason = isRestricted ? 'footway_not_bicycle_frei' : null;

  const displayCostSeconds = calculateDisplayCost(sourceId, edge, targetId, overrides, graph);
  const routingWeight = costFn
    ? costFn(sourceId, edge, targetId, overrides, graph)
    : standardCost(sourceId, edge, targetId, overrides, graph);

  // Extract node delay details
  let nodeDelaySeconds: number;
  let nodeDelayType: 'signal' | 'yield' | 'stop' | 'crossing' | 'custom' | null = null;
  const customDelay = overrides.nodeDelays.get(targetId);
  if (customDelay !== undefined) {
    nodeDelaySeconds = customDelay;
    nodeDelayType = 'custom';
  } else {
    const targetNode = graph.nodes.get(targetId)?.node;
    const tags = targetNode?.tags || {};
    nodeDelaySeconds = getDefaultNodeDelay(tags, overrides.rulesConfig?.nodeDelays);
    if (nodeDelaySeconds > 0) {
      const controlType = mapOSMNodeToControl(tags);
      nodeDelayType = controlType as 'signal' | 'yield' | 'stop' | 'crossing' | null;
    }
  }

  return {
    targetId,
    name: edge.name || 'Unnamed Street',
    distance: edge.distance,
    highway,
    baseSpeedKmh,
    effectiveSpeedKmh,
    surface: surfaceType,
    flatPenaltySeconds: flatPenalty,
    comfort,
    matchedSign: sign,
    matchedRoad: road,
    routingWeight,
    displayCostSeconds,
    isRestricted,
    turnPenaltySeconds: turnPenalty ?? 0,
    nodeDelaySeconds,
    nodeDelayType,
    restrictionReason,
  };
}
