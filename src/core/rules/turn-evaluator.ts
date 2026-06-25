import { ROUTING_CONFIG } from '../common/constants';
import type { Coordinate } from '../common/types';
import type { TurnRuleConfig } from '../config';

/**
 * Calculates the turn penalty (in seconds) between three points: p -> c -> n.
 */
export function calculateTurnPenalty(
  p: Coordinate,
  c: Coordinate,
  n: Coordinate,
  turns?: TurnRuleConfig,
): number {
  return getTurnDetails(p, c, n, turns).penalty;
}

/**
 * Calculates turn details (penalty, direction) between three points: p -> c -> n.
 */
export function getTurnDetails(
  p: Coordinate,
  c: Coordinate,
  n: Coordinate,
  turns?: TurnRuleConfig,
): {
  penalty: number;
  direction: 'left' | 'right' | 'u-turn' | 'straight';
} {
  const cosLat = Math.cos((c.lat * Math.PI) / 180);
  const v1x = (c.lng - p.lng) * cosLat;
  const v1y = c.lat - p.lat;
  const v2x = (n.lng - c.lng) * cosLat;
  const v2y = n.lat - c.lat;

  const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (len1 > 1e-7 && len2 > 1e-7) {
    const dot = v1x * v2x + v1y * v2y;
    const cosTheta = dot / (len1 * len2);
    const crossProduct = v1x * v2y - v1y * v2x;

    if (cosTheta < -0.7) {
      const penalty = turns ? turns.uTurnPenaltySeconds : ROUTING_CONFIG.U_TURN_PENALTY_SECONDS;
      return { penalty, direction: 'u-turn' };
    } else if (cosTheta >= -0.7 && cosTheta <= 0.7) {
      const direction = crossProduct > 0 ? 'left' : 'right';
      const penalty = turns
        ? direction === 'left'
          ? turns.leftTurnPenaltySeconds
          : turns.rightTurnPenaltySeconds
        : ROUTING_CONFIG.NORMAL_TURN_PENALTY_SECONDS;
      return { penalty, direction };
    }
  }
  return { penalty: 0, direction: 'straight' };
}
