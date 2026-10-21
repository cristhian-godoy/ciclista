import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type BikeConfig,
  type CrossingTurnOverride,
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
    expect(hookResult!.current.bikeConfig).toEqual({ id: 'normal' });
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
    const customBike: BikeConfig = {
      id: 'road',
      customSpeedKmh: 30,
    };

    vi.spyOn(LocalStorageProvider.prototype, 'loadRulesConfig').mockReturnValue(
      customRules as RulesConfiguration,
    );
    vi.spyOn(LocalStorageProvider.prototype, 'loadBikeConfig').mockReturnValue(customBike);

    let hookResult: ReturnType<typeof renderHook<ReturnType<typeof useOverrides>, void>>['result'];
    await act(async () => {
      const rendered = renderHook(() => useOverrides());
      hookResult = rendered.result;
    });

    expect(hookResult!.current.bikeConfig).toEqual(customBike);
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
});
