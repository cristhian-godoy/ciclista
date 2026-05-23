import { GermanSign, RoadType } from './types';

/**
 * Result of mapping an OSM way's tags to German traffic sign and road classification.
 */
export interface OSMRuleMatch {
  /** The matched German traffic sign, if any. Takes precedence over roadType for cost calculation. */
  sign: GermanSign | null;
  /** The matched road classification used as the speed baseline. */
  road: RoadType;
  /**
   * True when a "Fahrräder frei" supplementary sign is detected,
   * meaning cyclists are explicitly permitted on an otherwise restricted path.
   */
  bicycleFrei: boolean;
}

/**
 * Maps an OSM way's highway tag and full tag set to the applicable German
 * traffic sign and road classification for cycling cost evaluation.
 *
 * Priority order (highest to lowest):
 *   1. Explicit bicycle_road / fahrradstrasse tag → VZ 244.1
 *   2. Living street → VZ 325.1
 *   3. Shared foot+cycle path → VZ 240
 *   4. Segregated foot+cycle path → VZ 241
 *   5. Pedestrian zone → VZ 242.1
 *   6. Footway / sidewalk → VZ 239
 *   7. Road classifications (primary, secondary, residential, service, default)
 */
export function mapOSMToSignAndRoad(highway: string, tags: Record<string, string>): OSMRuleMatch {
  const bicycle = tags.bicycle;
  const foot = tags.foot;
  const bicycleFrei = bicycle === 'yes' || bicycle === 'designated' || bicycle === 'permissive';

  // ── 1. Bicycle street (Fahrradstraße) ──────────────────────────────────────
  if (tags.bicycle_road === 'yes' || tags.cyclestreet === 'yes' || highway === 'bicycle_road') {
    return { sign: GermanSign.VZ_244_1, road: RoadType.PATH_DEFAULT, bicycleFrei: true };
  }

  // ── 2. Cycleway (dedicated cycle path, no sign but best infrastructure) ────
  if (highway === 'cycleway') {
    return { sign: GermanSign.VZ_241, road: RoadType.PATH_DEFAULT, bicycleFrei: true };
  }

  // ── 3. Living street (Verkehrsberuhigter Bereich) ─────────────────────────
  if (highway === 'living_street') {
    return { sign: GermanSign.VZ_325_1, road: RoadType.RESIDENTIAL, bicycleFrei: true };
  }

  // ── 4. Path / track / footway: check for shared or segregated designation ───
  if (['path', 'track', 'footway'].includes(highway)) {
    const segregated = tags.segregated;
    if (
      (bicycle === 'designated' || bicycle === 'yes') &&
      (foot === 'designated' || foot === 'yes')
    ) {
      if (segregated === 'yes') {
        return { sign: GermanSign.VZ_241, road: RoadType.PATH_DEFAULT, bicycleFrei: true };
      }
      return { sign: GermanSign.VZ_240, road: RoadType.PATH_DEFAULT, bicycleFrei: true };
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
    return { sign: GermanSign.VZ_242_1, road: RoadType.PATH_DEFAULT, bicycleFrei };
  }

  // ── 7. Footway / sidewalk ─────────────────────────────────────────────────
  if (highway === 'footway' || highway === 'steps') {
    return { sign: GermanSign.VZ_239, road: RoadType.PATH_DEFAULT, bicycleFrei };
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
const CYCLEWAY_NEGATIVE = new Set(['no', 'none', 'separate', 'sidepath']);

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
