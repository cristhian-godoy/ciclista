import type { ComfortLevel, LocalOverrides } from '../config';
import type { GraphEdge, StreetGraph } from '../graph/types';
import {
  hasCycleway,
  mapBikeConfigToImpacts,
  mapOSMNodeToControl,
  mapOSMToSignAndRoad,
  mapRoadConfigToImpacts,
  mapSignConfigToImpacts,
} from '../rules';
import {
  applyRestrictedPathPenalty,
  getDefaultNodeDelay,
  resolveSpeedAndPenalty,
} from './edge-metrics';
import type { CostFunction } from './types';

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
