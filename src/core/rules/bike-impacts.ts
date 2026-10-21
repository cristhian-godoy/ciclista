import type { BikeConfig } from '../config';

/**
 * Impacts and modifiers of a specific bike configuration on routing metrics.
 */
export interface RouterBikeImpacts {
  cruisingSpeedKmh: number;
  surfaceModifiers: {
    gravel: { speedMultiplier: number; flatPenalty: number };
    cobblestone: { speedMultiplier: number; flatPenalty: number };
  };
}

/**
 * Resolves the hardcoded base cruising speed (in km/h) for the given bike profile ID.
 */
function getBaseSpeed(id: string): number {
  switch (id) {
    case 'road':
      return 30;
    case 'ebike':
      return 25;
    case 'slow':
      return 15;
    case 'normal':
    case 'custom':
    default:
      return 18;
  }
}

/**
 * Maps a generic user BikeConfig to the algorithmic impacts used for routing calculations.
 */
export function mapBikeConfigToImpacts(config: BikeConfig): RouterBikeImpacts {
  const speed = config.customSpeedKmh ?? getBaseSpeed(config.id);

  let impacts: RouterBikeImpacts;

  switch (config.id) {
    case 'road':
      impacts = {
        cruisingSpeedKmh: speed,
        surfaceModifiers: {
          gravel: { speedMultiplier: 0.4, flatPenalty: 15 },
          cobblestone: { speedMultiplier: 0.6, flatPenalty: 10 },
        },
      };
      break;
    case 'slow':
      impacts = {
        cruisingSpeedKmh: speed,
        surfaceModifiers: {
          gravel: { speedMultiplier: 0.9, flatPenalty: 0 },
          cobblestone: { speedMultiplier: 0.85, flatPenalty: 0 },
        },
      };
      break;
    case 'ebike':
      impacts = {
        cruisingSpeedKmh: speed,
        surfaceModifiers: {
          gravel: { speedMultiplier: 0.9, flatPenalty: 0 },
          cobblestone: { speedMultiplier: 0.8, flatPenalty: 0 },
        },
      };
      break;
    case 'normal':
    case 'custom':
    default:
      impacts = {
        cruisingSpeedKmh: speed,
        surfaceModifiers: {
          gravel: { speedMultiplier: 0.8, flatPenalty: 0 },
          cobblestone: { speedMultiplier: 0.75, flatPenalty: 0 },
        },
      };
      break;
  }

  if (config.surfacePreferences) {
    if (config.surfacePreferences.gravelSpeedMultiplier !== undefined) {
      impacts.surfaceModifiers.gravel.speedMultiplier =
        config.surfacePreferences.gravelSpeedMultiplier;
    }
    if (config.surfacePreferences.gravelFlatPenalty !== undefined) {
      impacts.surfaceModifiers.gravel.flatPenalty = config.surfacePreferences.gravelFlatPenalty;
    }
    if (config.surfacePreferences.cobblestoneSpeedMultiplier !== undefined) {
      impacts.surfaceModifiers.cobblestone.speedMultiplier =
        config.surfacePreferences.cobblestoneSpeedMultiplier;
    }
    if (config.surfacePreferences.cobblestoneFlatPenalty !== undefined) {
      impacts.surfaceModifiers.cobblestone.flatPenalty =
        config.surfacePreferences.cobblestoneFlatPenalty;
    }
  }

  return impacts;
}
