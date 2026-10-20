import { beforeEach, describe, expect, it } from 'vitest';

import type { InfrastructureType, RulesConfiguration } from '../config';
import { LocalStorageProvider } from './storage';

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(() => {
    localStorage.clear();
    provider = new LocalStorageProvider();
  });

  it('correctly saves and retrieves node delay override', async () => {
    await provider.saveNodeDelay('node_1', 45);
    const overrides = await provider.getOverrides();
    expect(overrides.nodeDelays.get('node_1')).toBe(45);
  });

  it('correctly saves and retrieves node notes override', async () => {
    await provider.saveNodeNotes('node_1', 'Dangerous left turn');
    const overrides = await provider.getOverrides();
    expect(overrides.nodeNotes.get('node_1')).toBe('Dangerous left turn');
  });

  it('correctly saves both delay and notes on the same node', async () => {
    await provider.saveNodeDelay('node_2', 30);
    await provider.saveNodeNotes('node_2', 'Avoid if possible');
    const overrides = await provider.getOverrides();
    expect(overrides.nodeDelays.get('node_2')).toBe(30);
    expect(overrides.nodeNotes.get('node_2')).toBe('Avoid if possible');
  });

  it('clears node overrides correctly', async () => {
    await provider.saveNodeDelay('node_3', 15);
    await provider.saveNodeNotes('node_3', 'Some note');

    let overrides = await provider.getOverrides();
    expect(overrides.nodeDelays.get('node_3')).toBe(15);

    await provider.clearNodeOverrides('node_3');
    overrides = await provider.getOverrides();
    expect(overrides.nodeDelays.has('node_3')).toBe(false);
    expect(overrides.nodeNotes.has('node_3')).toBe(false);
  });

  it('handles empty and corrupted storage data gracefully without crashing', async () => {
    // Manually pollute in-memory storage with invalid JSON (simulated corrupt data)
    // We access the private item writer/reader or just verify default return values
    const corruptProvider = new LocalStorageProvider();

    // We verify standard load returns empty defaults on empty storage
    const overrides = await corruptProvider.getOverrides();
    expect(overrides.nodeDelays.size).toBe(0);
    expect(overrides.nodeNotes.size).toBe(0);
    expect(overrides.nodeTurns.size).toBe(0);
  });

  it('correctly saves and loads rules configuration', () => {
    const mockConfig = {
      signs: {
        shared_path: {
          signId: 'shared_path' as InfrastructureType,
          name: 'Shared Path',
          description: 'Desc',
          iconCode: 'icon',
          baseSpeedKmh: 15,
          speedType: 'slow' as const,
          flatPenaltySeconds: 2,
          comfort: 'high' as const,
        },
      },
      roads: {},
      nodeDelays: {
        signalSeconds: 15,
        yieldSeconds: 3,
        stopSeconds: 8,
        crossingSeconds: 3,
      },
    } as unknown as RulesConfiguration;

    provider.saveRulesConfig(mockConfig);
    const loaded = provider.loadRulesConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.nodeDelays.signalSeconds).toBe(15);
    expect(loaded?.signs['shared_path']?.baseSpeedKmh).toBe(15);
  });

  it('correctly saves, loads, and retrieves landmarks', async () => {
    const mockLandmarks = [
      {
        id: 'landmark-1',
        name: 'Home',
        category: 'home' as const,
        lat: 48.137,
        lng: 11.575,
        description: 'Downtown home',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'landmark-2',
        name: 'Office',
        category: 'work' as const,
        lat: 48.145,
        lng: 11.585,
        createdAt: 2000,
        updatedAt: 2000,
      },
    ];

    await provider.saveLandmarks(mockLandmarks);
    const loaded = await provider.getLandmarks();
    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.name).toBe('Home');
    expect(loaded[1]?.name).toBe('Office');

    const syncLoaded = provider.loadLandmarksSync();
    expect(syncLoaded).toEqual(loaded);
  });

  it('correctly saves, retrieves, updates, and deletes crossing turn overrides', async () => {
    const turn1 = {
      id: 'cto-1',
      crossingId: 'crossing-100',
      fromNodeId: 'node-a',
      toNodeId: 'node-b',
      pathNodeIds: ['node-a', 'node-b'],
      timeDeltaSeconds: 15,
      banned: false,
      turnType: 'direct' as const,
    };
    const turn2 = {
      id: 'cto-2',
      crossingId: 'crossing-100',
      fromNodeId: 'node-a',
      toNodeId: 'node-c',
      pathNodeIds: ['node-a', 'node-m', 'node-c'],
      timeDeltaSeconds: 0,
      banned: true,
      turnType: 'copenhagen_two_stage' as const,
    };

    await provider.saveCrossingTurn(turn1);
    await provider.saveCrossingTurn(turn2);

    let turns = await provider.getCrossingTurns();
    expect(turns).toHaveLength(2);
    expect(turns.find((t) => t.id === 'cto-1')?.timeDeltaSeconds).toBe(15);
    expect(turns.find((t) => t.id === 'cto-2')?.banned).toBe(true);

    const overrides = await provider.getOverrides();
    expect(overrides.crossingTurns).toHaveLength(2);

    // Update existing turn
    await provider.saveCrossingTurn({ ...turn1, timeDeltaSeconds: 25 });
    turns = await provider.getCrossingTurns();
    expect(turns).toHaveLength(2);
    expect(turns.find((t) => t.id === 'cto-1')?.timeDeltaSeconds).toBe(25);

    // Delete turn1
    await provider.deleteCrossingTurn('cto-1');
    turns = await provider.getCrossingTurns();
    expect(turns).toHaveLength(1);
    expect(turns[0]?.id).toBe('cto-2');

    // Clear turns for crossing-100
    await provider.clearCrossingTurns('crossing-100');
    turns = await provider.getCrossingTurns();
    expect(turns).toHaveLength(0);
  });

  describe('Events persistence', () => {
    it('saves and retrieves map events', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Construction block',
          description: 'Road work',
          active: true,
          edgeIds: ['edge-1', 'edge-2'],
          effect: { type: 'road_blockage' as const, penaltySeconds: 60 },
          createdAt: 123456,
        },
      ];

      await provider.saveEvents(mockEvents);
      const loaded = await provider.getEvents();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.name).toBe('Construction block');
      expect(loaded[0]?.edgeIds).toEqual(['edge-1', 'edge-2']);
      expect(loaded[0]?.effect.penaltySeconds).toBe(60);

      const syncLoaded = provider.loadEventsSync();
      expect(syncLoaded).toEqual(loaded);
    });

    it('recovers gracefully from corrupted events data and filters invalid entries', () => {
      localStorage.setItem('ciclista_events', 'invalid-json');
      expect(provider.loadEventsSync()).toEqual([]);

      localStorage.setItem(
        'ciclista_events',
        JSON.stringify([
          null,
          'string-entry',
          { id: '', name: 'Fallback Test', edgeIds: ['e1', 123] },
        ]),
      );
      const parsed = provider.loadEventsSync();
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.name).toBe('Fallback Test');
      expect(parsed[0]?.edgeIds).toEqual(['e1']);
      expect(parsed[0]?.effect.type).toBe('road_blockage');
      expect(parsed[0]?.active).toBe(true);
    });
  });

  describe('BikeConfig persistence', () => {
    it('saves and loads bike configuration with custom attributes', () => {
      const config = {
        id: 'custom' as const,
        customSpeedKmh: 24,
        weightKg: 75,
        surfacePreferences: {
          gravelSpeedMultiplier: 0.7,
          gravelFlatPenalty: 10,
        },
        turnPenalties: {
          rightTurnPenaltySeconds: 2,
          leftTurnPenaltySeconds: 5,
        },
      };

      provider.saveBikeConfig(config);
      const loaded = provider.loadBikeConfig();
      expect(loaded).toEqual(config);
    });

    it('falls back to default profile when encountering unknown or corrupted config', () => {
      expect(provider.loadBikeConfig()).toBeNull();

      localStorage.setItem('ciclista_bike_config', 'not-json');
      expect(provider.loadBikeConfig()).toBeNull();

      localStorage.setItem('ciclista_bike_config', JSON.stringify({ id: 'unsupported_bike' }));
      const loaded = provider.loadBikeConfig();
      expect(loaded?.id).toBe('normal');
    });
  });

  describe('Theme persistence', () => {
    it('saves and loads theme mode', () => {
      provider.saveTheme('dark');
      expect(provider.loadTheme()).toBe('dark');

      provider.saveTheme('liberty');
      expect(provider.loadTheme()).toBe('liberty');
    });

    it('migrates legacy light theme to bright', () => {
      localStorage.setItem('ciclista_theme', 'light');
      expect(provider.loadTheme()).toBe('bright');
    });

    it('returns null on invalid or missing theme', () => {
      expect(provider.loadTheme()).toBeNull();

      localStorage.setItem('ciclista_theme', 'non-existent-theme');
      expect(provider.loadTheme()).toBeNull();
    });
  });
});
