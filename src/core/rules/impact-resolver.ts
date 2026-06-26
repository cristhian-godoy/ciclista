import type { InfrastructureType, RoadRuleConfig, RoadType, SignRuleConfig } from '../config';
import { getEffectiveRoadSpeedType, getEffectiveSignSpeedType } from './osm-mapper';
import type { ResolvedEdgeImpact, RouterRoadImpacts, RouterSignImpacts } from './types';

/**
 * Resolves an abstract speed type to speed in meters per second.
 */
function resolveSpeedTypeToMs(
  speedType: 'relative' | 'slow' | 'slower' | 'dismount' | 'custom',
  baseSpeedKmh: number,
  cruisingSpeedKmh: number,
): number {
  let kmh: number;
  switch (speedType) {
    case 'relative':
      kmh = cruisingSpeedKmh;
      break;
    case 'slow':
      kmh = 15;
      break;
    case 'slower':
      kmh = 10;
      break;
    case 'dismount':
      kmh = 4;
      break;
    case 'custom':
    default:
      kmh = baseSpeedKmh;
      break;
  }
  return kmh / 3.6;
}

/**
 * Maps a single sign rule config and bike cruising speed to a resolved algorithm impact.
 */
export function resolveSignImpact(
  cfg: SignRuleConfig,
  cruisingSpeedKmh: number,
): ResolvedEdgeImpact {
  const speedType = getEffectiveSignSpeedType(cfg);
  const effectiveSpeedMs = resolveSpeedTypeToMs(speedType, cfg.baseSpeedKmh, cruisingSpeedKmh);
  return {
    effectiveSpeedMs,
    flatPenaltySeconds: cfg.flatPenaltySeconds,
    comfort: cfg.comfort || 'neutral',
  };
}

/**
 * Maps a single road rule config and bike cruising speed to a resolved algorithm impact.
 */
export function resolveRoadImpact(
  cfg: RoadRuleConfig,
  cruisingSpeedKmh: number,
): ResolvedEdgeImpact {
  const speedType = getEffectiveRoadSpeedType(cfg);
  const effectiveSpeedMs = resolveSpeedTypeToMs(speedType, cfg.baseSpeedKmh, cruisingSpeedKmh);
  return {
    effectiveSpeedMs,
    flatPenaltySeconds: cfg.flatPenaltySeconds,
    comfort: cfg.comfort || 'neutral',
  };
}

/**
 * Transforms user sign configurations into concrete routing speed and penalty metrics.
 */
export function mapSignConfigToImpacts(
  signs: Record<InfrastructureType, SignRuleConfig>,
  cruisingSpeedKmh: number,
): RouterSignImpacts {
  const impacts = {} as RouterSignImpacts;
  const keys = Object.keys(signs) as InfrastructureType[];
  for (const key of keys) {
    impacts[key] = resolveSignImpact(signs[key], cruisingSpeedKmh);
  }
  return impacts;
}

/**
 * Transforms user road classification configurations into concrete routing speed and penalty metrics.
 */
export function mapRoadConfigToImpacts(
  roads: Record<RoadType, RoadRuleConfig>,
  cruisingSpeedKmh: number,
): RouterRoadImpacts {
  const impacts = {} as RouterRoadImpacts;
  const keys = Object.keys(roads) as RoadType[];
  for (const key of keys) {
    impacts[key] = resolveRoadImpact(roads[key], cruisingSpeedKmh);
  }
  return impacts;
}
