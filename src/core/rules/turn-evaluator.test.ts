import { describe, expect, it } from 'vitest';

import { ROUTING_CONFIG } from '../common/constants';
import type { TurnRuleConfig } from '../config';
import { calculateTurnPenalty, getTurnDetails } from './turn-evaluator';

describe('turn-evaluator', () => {
  const p = { lat: 48.0, lng: 11.0 };
  const c = { lat: 48.0, lng: 11.01 }; // East from p

  it('evaluates straight trajectory with zero penalty', () => {
    const n = { lat: 48.0, lng: 11.02 }; // Continuing straight East
    const details = getTurnDetails(p, c, n);
    expect(details.direction).toBe('straight');
    expect(details.penalty).toBe(0);
    expect(calculateTurnPenalty(p, c, n)).toBe(0);
  });

  it('evaluates left turn correctly', () => {
    const n = { lat: 48.01, lng: 11.01 }; // Turning North (left)
    const details = getTurnDetails(p, c, n);
    expect(details.direction).toBe('left');
    expect(details.penalty).toBe(ROUTING_CONFIG.NORMAL_TURN_PENALTY_SECONDS);
  });

  it('evaluates right turn correctly', () => {
    const n = { lat: 47.99, lng: 11.01 }; // Turning South (right)
    const details = getTurnDetails(p, c, n);
    expect(details.direction).toBe('right');
    expect(details.penalty).toBe(ROUTING_CONFIG.NORMAL_TURN_PENALTY_SECONDS);
  });

  it('evaluates u-turn correctly', () => {
    const n = { lat: 48.0, lng: 11.0 }; // Reversing back West
    const details = getTurnDetails(p, c, n);
    expect(details.direction).toBe('u-turn');
    expect(details.penalty).toBe(ROUTING_CONFIG.U_TURN_PENALTY_SECONDS);
    expect(calculateTurnPenalty(p, c, n)).toBe(ROUTING_CONFIG.U_TURN_PENALTY_SECONDS);
  });

  it('respects custom TurnRuleConfig overrides', () => {
    const customConfig: TurnRuleConfig = {
      leftTurnPenaltySeconds: 8,
      rightTurnPenaltySeconds: 4,
      greenArrowRightTurnSeconds: 2,
      indirectLeftTurnSeconds: 6,
      uTurnPenaltySeconds: 45,
    };

    const leftNode = { lat: 48.01, lng: 11.01 };
    expect(getTurnDetails(p, c, leftNode, customConfig)).toEqual({
      penalty: 8,
      direction: 'left',
    });

    const rightNode = { lat: 47.99, lng: 11.01 };
    expect(getTurnDetails(p, c, rightNode, customConfig)).toEqual({
      penalty: 4,
      direction: 'right',
    });

    const uTurnNode = { lat: 48.0, lng: 11.0 };
    expect(getTurnDetails(p, c, uTurnNode, customConfig)).toEqual({
      penalty: 45,
      direction: 'u-turn',
    });
  });

  it('handles degenerate coordinates with identical points safely', () => {
    const details = getTurnDetails(p, p, p);
    expect(details.direction).toBe('straight');
    expect(details.penalty).toBe(0);
  });
});
