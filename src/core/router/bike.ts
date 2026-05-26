import type { BikeConfig } from '../storage/types';

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

  switch (config.id) {
    case 'road':
      return {
        cruisingSpeedKmh: speed,
        surfaceModifiers: {
          gravel: { speedMultiplier: 0.4, flatPenalty: 15 },
          cobblestone: { speedMultiplier: 0.6, flatPenalty: 10 },
        },
      };
    case 'slow':
      return {
        cruisingSpeedKmh: speed,
        surfaceModifiers: {
          gravel: { speedMultiplier: 0.9, flatPenalty: 0 },
          cobblestone: { speedMultiplier: 0.85, flatPenalty: 0 },
        },
      };
    case 'ebike':
      return {
        cruisingSpeedKmh: speed,
        surfaceModifiers: {
          gravel: { speedMultiplier: 0.9, flatPenalty: 0 },
          cobblestone: { speedMultiplier: 0.8, flatPenalty: 0 },
        },
      };
    case 'normal':
    case 'custom':
    default:
      return {
        cruisingSpeedKmh: speed,
        surfaceModifiers: {
          gravel: { speedMultiplier: 0.8, flatPenalty: 0 },
          cobblestone: { speedMultiplier: 0.75, flatPenalty: 0 },
        },
      };
  }
}
