import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type BikeProfile,
  type CrossingTurnOverride,
  DEFAULT_BIKES,
  DEFAULT_RULES_CONFIG,
  type RulesConfiguration,
  type SemanticTurnType,
} from '../core/config';
import { LocalStorageProvider } from '../core/storage/storage';
import { useOverrides } from './useOverrides';

describe('useOverrides hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('initializes with default rules configuration and normal bike config when storage is empty', async () => {
    let hookResult: ReturnType<typeof renderHook<ReturnType<typeof useOverrides>, void>>['result'];
    await act(async () => {
      const rendered = renderHook(() => useOverrides());
      hookResult = rendered.result;
    });

    expect(hookResult!.current.nodeDelays).toBeInstanceOf(Map);
    expect(hookResult!.current.nodeDelays.size).toBe(0);
    expect(hookResult!.current.nodeNotes.size).toBe(0);
    expect(hookResult!.current.nodeTurns.size).toBe(0);
    expect(hookResult!.current.crossingTurns).toEqual([]);
    expect(hookResult!.current.bikes).toEqual(DEFAULT_BIKES);
    expect(hookResult!.current.activeBikeId).toBe('normal');
    expect(hookResult!.current.bikeConfig).toEqual({
      id: 'normal',
      customSpeedKmh: 18,
      surfacePreferences: {
        gravelSpeedMultiplier: 0.8,
        cobblestoneSpeedMultiplier: 0.75,
      },
      turnPenalties: {
        rightTurnPenaltySeconds: 1,
        leftTurnPenaltySeconds: 4,
        uTurnPenaltySeconds: 30,
      },
      weightKg: undefined,
    });
    expect(hookResult!.current.rulesConfig.signs).toEqual(DEFAULT_RULES_CONFIG.signs);
    expect(hookResult!.current.rulesConfig.roads).toEqual(DEFAULT_RULES_CONFIG.roads);
    expect(hookResult!.current.rulesConfig.turns).toEqual(DEFAULT_RULES_CONFIG.turns);
  });

  it('restores and deep merges saved rulesConfig and bikeConfig from storage', async () => {
    const customRules = {
      ...DEFAULT_RULES_CONFIG,
      signs: {
        ...DEFAULT_RULES_CONFIG.signs,
        segregated_path: {
          ...DEFAULT_RULES_CONFIG.signs.segregated_path,
          flatPenaltySeconds: 5,
        },
      },
      turns: {
        rightTurnPenaltySeconds: 12,
        leftTurnPenaltySeconds: 20,
        greenArrowRightTurnSeconds: 2,
        indirectLeftTurnSeconds: 8,
        uTurnPenaltySeconds: 50,
      },
    };
    const customBikes: BikeProfile[] = [
      {
        id: 'road',
        name: 'Road Bike',
        speedKmh: 30,
      },
    ];

    vi.spyOn(LocalStorageProvider.prototype, 'loadRulesConfig').mockReturnValue(
      customRules as RulesConfiguration,
    );
    localStorage.setItem('ciclista_bikes_v1', JSON.stringify(customBikes));
    localStorage.setItem('ciclista_active_bike_id_v1', 'road');

    let hookResult: ReturnType<typeof renderHook<ReturnType<typeof useOverrides>, void>>['result'];
    await act(async () => {
      const rendered = renderHook(() => useOverrides());
      hookResult = rendered.result;
    });

    expect(hookResult!.current.bikeConfig).toEqual({
      id: 'road',
      customSpeedKmh: 30,
      weightKg: undefined,
      surfacePreferences: undefined,
      turnPenalties: undefined,
    });
    expect(hookResult!.current.rulesConfig.turns.rightTurnPenaltySeconds).toBe(12);
    // Signs should be deep merged with defaults
    expect(hookResult!.current.rulesConfig.signs.segregated_path.flatPenaltySeconds).toBe(5);
    expect(hookResult!.current.rulesConfig.signs.pedestrian_zone).toBeDefined();
  });

  it('loads persistent overrides (node delays, notes, turns, crossing turns) on mount', async () => {
    const savedDelays = new Map([['n1', 25]]);
    const savedNotes = new Map([['n1', 'Careful on turn']]);
    const savedTurns = new Map<string, Record<string, SemanticTurnType>>([
      ['n1', { n2: 'green_arrow_right' }],
    ]);
    const savedCrossings: CrossingTurnOverride[] = [
      {
        id: 'turn-1',
        crossingId: 'c1',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        timeDeltaSeconds: 15,
        banned: false,
        turnType: 'direct',
      },
    ];

    vi.spyOn(LocalStorageProvider.prototype, 'getOverrides').mockResolvedValue({
      nodeDelays: savedDelays,
      nodeNotes: savedNotes,
      nodeTurns: savedTurns,
      crossingTurns: savedCrossings,
      rulesConfig: DEFAULT_RULES_CONFIG,
    });

    const { result } = renderHook(() => useOverrides());

    await waitFor(() => {
      expect(result.current.nodeDelays.get('n1')).toBe(25);
    });

    expect(result.current.nodeNotes.get('n1')).toBe('Careful on turn');
    expect(result.current.nodeTurns.get('n1')).toEqual({ n2: 'green_arrow_right' });
    expect(result.current.crossingTurns).toHaveLength(1);
    expect(result.current.crossingTurns[0]?.id).toBe('turn-1');
  });

  it('persists node override changes via handleSaveNodeOverride', async () => {
    const saveDelaySpy = vi.spyOn(LocalStorageProvider.prototype, 'saveNodeDelay');
    const saveNotesSpy = vi.spyOn(LocalStorageProvider.prototype, 'saveNodeNotes');

    const { result } = renderHook(() => useOverrides());

    await act(async () => {
      await result.current.handleSaveNodeOverride('node-10', 45, 'High traffic crossing');
    });

    expect(saveDelaySpy).toHaveBeenCalledWith('node-10', 45);
    expect(saveNotesSpy).toHaveBeenCalledWith('node-10', 'High traffic crossing');
  });

  it('persists node turn restrictions via handleSaveNodeTurns', async () => {
    const saveTurnsSpy = vi.spyOn(LocalStorageProvider.prototype, 'saveNodeTurns');

    const { result } = renderHook(() => useOverrides());

    await act(async () => {
      await result.current.handleSaveNodeTurns('node-10', { 'node-20': 'indirect_left' });
    });

    expect(saveTurnsSpy).toHaveBeenCalledWith('node-10', { 'node-20': 'indirect_left' });
  });

  it('clears node overrides via handleClearNodeOverride', async () => {
    const clearSpy = vi.spyOn(LocalStorageProvider.prototype, 'clearNodeOverrides');

    const { result } = renderHook(() => useOverrides());

    await act(async () => {
      await result.current.handleClearNodeOverride('node-10');
    });

    expect(clearSpy).toHaveBeenCalledWith('node-10');
  });

  it('saves and deletes crossing turns via handleSaveCrossingTurn and handleDeleteCrossingTurn', async () => {
    const saveCrossingSpy = vi.spyOn(LocalStorageProvider.prototype, 'saveCrossingTurn');
    const deleteCrossingSpy = vi.spyOn(LocalStorageProvider.prototype, 'deleteCrossingTurn');

    const { result } = renderHook(() => useOverrides());

    const turnOverride: CrossingTurnOverride = {
      id: 'crossing-override-1',
      crossingId: 'cross-1',
      fromNodeId: 'node-A',
      toNodeId: 'node-B',
      timeDeltaSeconds: 30,
      banned: true,
      turnType: 'copenhagen_two_stage',
    };

    await act(async () => {
      await result.current.handleSaveCrossingTurn(turnOverride);
    });
    expect(saveCrossingSpy).toHaveBeenCalledWith(turnOverride);

    await act(async () => {
      await result.current.handleDeleteCrossingTurn('crossing-override-1');
    });
    expect(deleteCrossingSpy).toHaveBeenCalledWith('crossing-override-1');
  });

  it('persists rulesConfig and bikeConfig state modifications to storage', async () => {
    const saveRulesSpy = vi.spyOn(LocalStorageProvider.prototype, 'saveRulesConfig');
    const saveBikeSpy = vi.spyOn(LocalStorageProvider.prototype, 'saveBikeConfig');

    const { result } = renderHook(() => useOverrides());

    await act(async () => {
      result.current.setBikeConfig({ id: 'custom', customSpeedKmh: 28 });
    });
    expect(saveBikeSpy).toHaveBeenCalledWith({ id: 'custom', customSpeedKmh: 28 });

    await act(async () => {
      result.current.setRulesConfig({
        ...DEFAULT_RULES_CONFIG,
        turns: {
          ...DEFAULT_RULES_CONFIG.turns,
          rightTurnPenaltySeconds: 99,
        },
      });
    });
    expect(saveRulesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: expect.objectContaining({ rightTurnPenaltySeconds: 99 }),
      }),
    );
  });

  describe('BikeProfile user management and persistence', () => {
    it('manages active bike selection and auto-syncs bikeConfig and localStorage', async () => {
      let hookResult: ReturnType<
        typeof renderHook<ReturnType<typeof useOverrides>, void>
      >['result'];
      await act(async () => {
        const rendered = renderHook(() => useOverrides());
        hookResult = rendered.result;
      });

      expect(hookResult!.current.activeBikeId).toBe('normal');
      expect(hookResult!.current.bikeConfig.customSpeedKmh).toBe(18);

      await act(async () => {
        hookResult!.current.setActiveBikeId('ebike');
      });

      expect(hookResult!.current.activeBikeId).toBe('ebike');
      expect(hookResult!.current.bikeConfig).toEqual({
        id: 'ebike',
        customSpeedKmh: 25,
        surfacePreferences: {
          gravelSpeedMultiplier: 0.8,
          cobblestoneSpeedMultiplier: 0.75,
        },
        turnPenalties: {
          rightTurnPenaltySeconds: 1,
          leftTurnPenaltySeconds: 4,
          uTurnPenaltySeconds: 30,
        },
        weightKg: undefined,
      });
      expect(localStorage.getItem('ciclista_active_bike_id_v1')).toBe('ebike');
    });

    it('adds new bike profile and persists to localStorage', async () => {
      let hookResult: ReturnType<
        typeof renderHook<ReturnType<typeof useOverrides>, void>
      >['result'];
      await act(async () => {
        const rendered = renderHook(() => useOverrides());
        hookResult = rendered.result;
      });

      const newBike: BikeProfile = {
        id: 'gravel-custom',
        name: 'Gravel Custom',
        speedKmh: 22,
        weightKg: 11,
        surfacePreferences: {
          gravelSpeedMultiplier: 0.95,
        },
      };

      await act(async () => {
        hookResult!.current.addBike(newBike);
      });

      expect(hookResult!.current.bikes).toHaveLength(3);
      expect(hookResult!.current.bikes[2]).toEqual(newBike);

      const stored = JSON.parse(localStorage.getItem('ciclista_bikes_v1') || '[]');
      expect(stored).toHaveLength(3);
      expect(stored[2]).toEqual(newBike);
    });

    it('updates existing bike profile and reflects in active bikeConfig if active', async () => {
      let hookResult: ReturnType<
        typeof renderHook<ReturnType<typeof useOverrides>, void>
      >['result'];
      await act(async () => {
        const rendered = renderHook(() => useOverrides());
        hookResult = rendered.result;
      });

      await act(async () => {
        hookResult!.current.updateBike({
          id: 'normal',
          name: 'Tuned Normal',
          speedKmh: 21,
          weightKg: 13,
        });
      });

      expect(hookResult!.current.bikes.find((b) => b.id === 'normal')).toMatchObject({
        id: 'normal',
        name: 'Tuned Normal',
        speedKmh: 21,
        weightKg: 13,
      });
      expect(hookResult!.current.bikeConfig.customSpeedKmh).toBe(21);
      expect(hookResult!.current.bikeConfig.weightKg).toBe(13);

      // Also verify partial update by id
      await act(async () => {
        hookResult!.current.updateBike('ebike', { speedKmh: 32 });
      });

      expect(hookResult!.current.bikes.find((b) => b.id === 'ebike')?.speedKmh).toBe(32);
    });

    it('deletes a bike, falls back activeBikeId if deleted, and enforces minimum 1 bike guard', async () => {
      let hookResult: ReturnType<
        typeof renderHook<ReturnType<typeof useOverrides>, void>
      >['result'];
      await act(async () => {
        const rendered = renderHook(() => useOverrides());
        hookResult = rendered.result;
      });

      expect(hookResult!.current.bikes).toHaveLength(2);
      expect(hookResult!.current.activeBikeId).toBe('normal');

      // Delete active bike ('normal') -> should switch activeBikeId to first remaining ('ebike')
      await act(async () => {
        hookResult!.current.deleteBike('normal');
      });

      expect(hookResult!.current.bikes).toHaveLength(1);
      expect(hookResult!.current.bikes[0]?.id).toBe('ebike');
      expect(hookResult!.current.activeBikeId).toBe('ebike');
      expect(hookResult!.current.bikeConfig.customSpeedKmh).toBe(25);

      // Attempt deleting the last remaining bike -> must be a no-op
      await act(async () => {
        hookResult!.current.deleteBike('ebike');
      });

      expect(hookResult!.current.bikes).toHaveLength(1);
      expect(hookResult!.current.bikes[0]?.id).toBe('ebike');
      expect(hookResult!.current.activeBikeId).toBe('ebike');

      // Attempt deleting nonexistent id -> no-op
      await act(async () => {
        hookResult!.current.deleteBike('unknown-bike');
      });

      expect(hookResult!.current.bikes).toHaveLength(1);
    });

    it('falls back to DEFAULT_BIKES when localStorage is missing or empty array', async () => {
      localStorage.setItem('ciclista_bikes_v1', JSON.stringify([]));
      localStorage.setItem('ciclista_active_bike_id_v1', 'non-existent-bike');

      let hookResult: ReturnType<
        typeof renderHook<ReturnType<typeof useOverrides>, void>
      >['result'];
      await act(async () => {
        const rendered = renderHook(() => useOverrides());
        hookResult = rendered.result;
      });

      expect(hookResult!.current.bikes).toEqual(DEFAULT_BIKES);
      expect(hookResult!.current.activeBikeId).toBe('normal');
    });

    it('handles corrupted localStorage JSON gracefully', async () => {
      localStorage.setItem('ciclista_bikes_v1', '{corrupt json');

      let hookResult: ReturnType<
        typeof renderHook<ReturnType<typeof useOverrides>, void>
      >['result'];
      await act(async () => {
        const rendered = renderHook(() => useOverrides());
        hookResult = rendered.result;
      });

      expect(hookResult!.current.bikes).toEqual(DEFAULT_BIKES);
      expect(hookResult!.current.activeBikeId).toBe('normal');
    });
  });
});
