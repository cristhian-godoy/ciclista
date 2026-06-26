import type { RoadRuleConfig, SignRuleConfig } from '../config';
import { InfrastructureType, RoadType } from '../config';

/**
 * Result of mapping an OSM way's tags to infrastructure concept and road classification.
 */
export interface OSMRuleMatch {
  /** The matched infrastructure concept, if any. Takes precedence over roadType for cost calculation. */
  sign: InfrastructureType | null;
  /** The matched road classification used as the speed baseline. */
  road: RoadType;
  /**
   * True when cyclists are explicitly permitted on an otherwise restricted path.
   */
  bicycleFrei: boolean;
}

/**
 * Maps an OSM way's highway tag and full tag set to the applicable infrastructure concept
 * and road classification for cycling cost evaluation.
 *
 * Priority order (highest to lowest):
 *   1. Explicit bicycle_road / fahrradstrasse tag → BICYCLE_STREET
 *   2. Living street → LIVING_STREET
 *   3. Shared foot+cycle path → SHARED_PATH
 *   4. Segregated foot+cycle path → SEGREGATED_PATH
 *   5. Pedestrian zone → PEDESTRIAN_ZONE
 *   6. Footway / sidewalk → SIDEWALK
 *   7. Road classifications (primary, secondary, residential, service, default)
 */
export function mapOSMToSignAndRoad(highway: string, tags: Record<string, string>): OSMRuleMatch {
  const bicycle = tags.bicycle;
  const foot = tags.foot;
  const bicycleFrei = bicycle === 'yes' || bicycle === 'designated' || bicycle === 'permissive';

  // ── 1. Bicycle street ──────────────────────────────────────────────────────
  if (tags.bicycle_road === 'yes' || tags.cyclestreet === 'yes' || highway === 'bicycle_road') {
    return {
      sign: InfrastructureType.BICYCLE_STREET,
      road: RoadType.PATH_DEFAULT,
      bicycleFrei: true,
    };
  }

  // ── 2. Cycleway (dedicated cycle path) ─────────────────────────────────────
  if (highway === 'cycleway') {
    return {
      sign: InfrastructureType.SEGREGATED_PATH,
      road: RoadType.PATH_DEFAULT,
      bicycleFrei: true,
    };
  }

  // ── 3. Living street ──────────────────────────────────────────────────────
  if (highway === 'living_street') {
    return {
      sign: InfrastructureType.LIVING_STREET,
      road: RoadType.RESIDENTIAL,
      bicycleFrei: true,
    };
  }

  // ── 4. Path / track / footway: check for shared or segregated designation ───
  if (['path', 'track', 'footway'].includes(highway)) {
    const segregated = tags.segregated;
    if (
      (bicycle === 'designated' || bicycle === 'yes') &&
      (foot === 'designated' || foot === 'yes')
    ) {
      if (segregated === 'yes') {
        return {
          sign: InfrastructureType.SEGREGATED_PATH,
          road: RoadType.PATH_DEFAULT,
          bicycleFrei: true,
        };
      }
      return {
        sign: InfrastructureType.SHARED_PATH,
        road: RoadType.PATH_DEFAULT,
        bicycleFrei: true,
      };
    }
  }

  // ── 5. Path / track fallbacks ─────────────────────────────────────────────
  if (highway === 'path' || highway === 'track') {
    // Generic path open to cyclists
    if (bicycleFrei) {
      return { sign: null, road: RoadType.PATH_DEFAULT, bicycleFrei: true };
    }
    return { sign: null, road: RoadType.PATH_DEFAULT, bicycleFrei: false };
  }

  // ── 6. Pedestrian zone ────────────────────────────────────────────────────
  if (highway === 'pedestrian') {
    return {
      sign: InfrastructureType.PEDESTRIAN_ZONE,
      road: RoadType.PATH_DEFAULT,
      bicycleFrei,
    };
  }

  // ── 7. Footway / sidewalk ─────────────────────────────────────────────────
  if (highway === 'footway' || highway === 'steps') {
    return {
      sign: InfrastructureType.SIDEWALK,
      road: RoadType.PATH_DEFAULT,
      bicycleFrei,
    };
  }

  // ── 7. Road classifications ───────────────────────────────────────────────
  if (highway === 'primary' || highway === 'primary_link') {
    return { sign: null, road: RoadType.PRIMARY, bicycleFrei: true };
  }
  if (highway === 'secondary' || highway === 'secondary_link') {
    return { sign: null, road: RoadType.SECONDARY, bicycleFrei: true };
  }
  if (
    highway === 'residential' ||
    highway === 'tertiary' ||
    highway === 'tertiary_link' ||
    highway === 'unclassified'
  ) {
    return { sign: null, road: RoadType.RESIDENTIAL, bicycleFrei: true };
  }
  if (highway === 'service') {
    return { sign: null, road: RoadType.SERVICE, bicycleFrei: true };
  }

  // ── 8. Fallback ───────────────────────────────────────────────────────────
  return { sign: null, road: RoadType.PATH_DEFAULT, bicycleFrei: true };
}

/**
 * Classifies an OSM node's tags into a traffic control type.
 * Note: Only relevant crossings (e.g. zebra, marked) that strictly require yielding or stopping
 * are classified as 'crossing'. Unmarked, informal, or generic highway=crossing tags without priority
 * specifications return null to be treated as standard non-delay nodes.
 */
export function mapOSMNodeToControl(
  tags: Record<string, string>,
): 'signal' | 'yield' | 'stop' | 'crossing' | null {
  if (
    tags.highway === 'traffic_signals' ||
    tags.crossing === 'traffic_signals' ||
    tags.crossing === 'controlled'
  ) {
    return 'signal';
  }
  if (tags.highway === 'give_way') {
    return 'yield';
  }
  if (tags.highway === 'stop') {
    return 'stop';
  }
  if (tags.crossing === 'zebra' || tags.crossing === 'marked') {
    return 'crossing';
  }
  return null;
}

/** OSM values that explicitly negate the presence of a cycleway. */
const CYCLEWAY_NEGATIVE = new Set(['no', 'none', 'separate']);

/**
 * Checks if a set of OSM way tags indicates the presence of a cycleway on the street.
 * Correctly handles negative values like cycleway:both=no, which are truthy strings
 * in JS but explicitly mean "no cycleway here".
 */
export function hasCycleway(tags: Record<string, string>): boolean {
  const candidates = [
    tags.cycleway,
    tags['cycleway:left'],
    tags['cycleway:right'],
    tags['cycleway:both'],
  ];
  return candidates.some((v) => v !== undefined && !CYCLEWAY_NEGATIVE.has(v));
}

/**
 * Resolves the effective speed type for a traffic sign rule configuration.
 * Falls back to default classification-based types if no custom value is specified.
 *
 * @param cfg - The sign rule config containing optional custom speedType and sign ID.
 * @returns The resolved speed type.
 */
export function getEffectiveSignSpeedType(
  cfg: SignRuleConfig,
): 'relative' | 'slow' | 'slower' | 'dismount' | 'custom' {
  if (cfg.speedType) return cfg.speedType;
  const signId = cfg.signId;
  if (
    signId === InfrastructureType.SEGREGATED_PATH ||
    signId === InfrastructureType.BICYCLE_STREET ||
    signId === InfrastructureType.LIVING_STREET
  ) {
    return 'relative';
  }
  if (signId === InfrastructureType.PEDESTRIAN_ZONE || signId === InfrastructureType.SIDEWALK) {
    return 'dismount';
  }
  return 'custom';
}

/**
 * Resolves the effective speed type for a road rule configuration.
 * Falls back to 'custom' speed rules if no specific type override is set.
 *
 * @param cfg - The road rule config containing optional custom speedType.
 * @returns The resolved speed type.
 */
export function getEffectiveRoadSpeedType(
  cfg: RoadRuleConfig,
): 'relative' | 'slow' | 'slower' | 'dismount' | 'custom' {
  if (cfg.speedType) return cfg.speedType;
  return 'custom';
}

/**
 * Classifies an OSM surface tag (or highway fallback) into paved, gravel, or cobblestone.
 */
export function getSurfaceType(tags: Record<string, string>): 'paved' | 'gravel' | 'cobblestone' {
  const surface = tags.surface;
  if (!surface) {
    if (tags.highway === 'track') {
      return 'gravel';
    }
    return 'paved';
  }

  const pavedValues = [
    'asphalt',
    'concrete',
    'paved',
    'paving_stones',
    'sett',
    'concrete:lanes',
    'concrete:plates',
  ];
  const gravelValues = [
    'gravel',
    'unpaved',
    'compacted',
    'fine_gravel',
    'dirt',
    'earth',
    'grass',
    'ground',
    'mud',
    'sand',
  ];
  const cobblestoneValues = ['cobblestone', 'cobblestone:flattened', 'grass_paver'];

  if (pavedValues.includes(surface)) {
    return 'paved';
  }
  if (gravelValues.includes(surface)) {
    return 'gravel';
  }
  if (cobblestoneValues.includes(surface)) {
    return 'cobblestone';
  }

  return 'paved';
}
