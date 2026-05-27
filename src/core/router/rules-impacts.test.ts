import { describe, expect, it } from 'vitest';

import { DEFAULT_RULES_CONFIG } from './rules';
import {
  mapRoadConfigToImpacts,
  mapSignConfigToImpacts,
  resolveRoadImpact,
  resolveSignImpact,
} from './rules-impacts';
import type { RoadRuleConfig, SignRuleConfig } from './types';
import { InfrastructureType, RoadType } from './types';

describe('rules-impacts mappers', () => {
  describe('resolveRoadImpact', () => {
    it('resolves relative speed type correctly based on profile', () => {
      const cfg: RoadRuleConfig = {
        roadId: RoadType.RESIDENTIAL,
        name: 'Residential',
        baseSpeedKmh: 17,
        speedType: 'relative',
        flatPenaltySeconds: 0,
      };
      expect(resolveRoadImpact(cfg, 15).effectiveSpeedMs).toBeCloseTo(15 / 3.6, 5);
      expect(resolveRoadImpact(cfg, 18).effectiveSpeedMs).toBeCloseTo(18 / 3.6, 5);
      expect(resolveRoadImpact(cfg, 25).effectiveSpeedMs).toBeCloseTo(25 / 3.6, 5);
    });

    it('resolves fixed speed types slow, slower, and dismount', () => {
      const base: RoadRuleConfig = {
        roadId: RoadType.RESIDENTIAL,
        name: 'Residential',
        baseSpeedKmh: 17,
        flatPenaltySeconds: 0,
      };
      expect(resolveRoadImpact({ ...base, speedType: 'slow' }, 25).effectiveSpeedMs).toBeCloseTo(
        15 / 3.6,
        5,
      );
      expect(resolveRoadImpact({ ...base, speedType: 'slower' }, 25).effectiveSpeedMs).toBeCloseTo(
        10 / 3.6,
        5,
      );
      expect(
        resolveRoadImpact({ ...base, speedType: 'dismount' }, 25).effectiveSpeedMs,
      ).toBeCloseTo(4 / 3.6, 5);
    });

    it('resolves custom speed type to baseSpeedKmh', () => {
      const cfg: RoadRuleConfig = {
        roadId: RoadType.RESIDENTIAL,
        name: 'Residential',
        baseSpeedKmh: 22,
        speedType: 'custom',
        flatPenaltySeconds: 0,
      };
      expect(resolveRoadImpact(cfg, 25).effectiveSpeedMs).toBeCloseTo(22 / 3.6, 5);
    });

    it('resolves fallback default speed types if speedType is undefined', () => {
      const roadCfg: RoadRuleConfig = {
        roadId: RoadType.PRIMARY,
        name: 'Primary Road',
        baseSpeedKmh: 14,
        flatPenaltySeconds: 0,
      };
      expect(resolveRoadImpact(roadCfg, 25).effectiveSpeedMs).toBeCloseTo(14 / 3.6, 5); // default for road is custom
    });

    it('defaults comfort to neutral when undefined', () => {
      const cfg: RoadRuleConfig = {
        roadId: RoadType.PRIMARY,
        name: 'Primary Road',
        baseSpeedKmh: 14,
        flatPenaltySeconds: 0,
      };
      expect(resolveRoadImpact(cfg, 25).comfort).toBe('neutral');
    });

    it('respects comfort override', () => {
      const cfg: RoadRuleConfig = {
        roadId: RoadType.PRIMARY,
        name: 'Primary Road',
        baseSpeedKmh: 14,
        flatPenaltySeconds: 0,
        comfort: 'low',
      };
      expect(resolveRoadImpact(cfg, 25).comfort).toBe('low');
    });
  });

  describe('resolveSignImpact', () => {
    it('resolves fallback default speed types if speedType is undefined', () => {
      const signCfg: SignRuleConfig = {
        signId: InfrastructureType.SEGREGATED_PATH,
        name: 'Segregated Path',
        description: '...',
        iconCode: '🚲',
        baseSpeedKmh: 18,
        flatPenaltySeconds: 0,
      };
      expect(resolveSignImpact(signCfg, 25).effectiveSpeedMs).toBeCloseTo(25 / 3.6, 5); // relative

      const sidewalkCfg: SignRuleConfig = {
        signId: InfrastructureType.SIDEWALK,
        name: 'Sidewalk',
        description: '...',
        iconCode: '🦶',
        baseSpeedKmh: 5,
        flatPenaltySeconds: 0,
      };
      expect(resolveSignImpact(sidewalkCfg, 25).effectiveSpeedMs).toBeCloseTo(4 / 3.6, 5); // dismount
    });

    it('resolves custom speed type overrides', () => {
      const signCfg: SignRuleConfig = {
        signId: InfrastructureType.SEGREGATED_PATH,
        name: 'Segregated Path',
        description: '...',
        iconCode: '🚲',
        baseSpeedKmh: 18,
        speedType: 'custom',
        flatPenaltySeconds: 0,
      };
      expect(resolveSignImpact(signCfg, 25).effectiveSpeedMs).toBeCloseTo(18 / 3.6, 5);
    });

    it('defaults comfort to neutral when undefined', () => {
      const signCfg: SignRuleConfig = {
        signId: InfrastructureType.SEGREGATED_PATH,
        name: 'Segregated Path',
        description: '...',
        iconCode: '🚲',
        baseSpeedKmh: 18,
        flatPenaltySeconds: 0,
      };
      expect(resolveSignImpact(signCfg, 25).comfort).toBe('neutral');
    });
  });

  describe('bulk mappers', () => {
    it('maps bulk sign and road configurations matching the default rules config', () => {
      const signImpacts = mapSignConfigToImpacts(DEFAULT_RULES_CONFIG.signs, 18);
      const roadImpacts = mapRoadConfigToImpacts(DEFAULT_RULES_CONFIG.roads, 18);

      expect(signImpacts[InfrastructureType.SEGREGATED_PATH]).toBeDefined();
      expect(signImpacts[InfrastructureType.SEGREGATED_PATH].comfort).toBe('very_high');

      expect(roadImpacts[RoadType.PRIMARY]).toBeDefined();
      expect(roadImpacts[RoadType.PRIMARY].comfort).toBe('very_low');
    });
  });
});
