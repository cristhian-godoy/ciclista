import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type BikeConfig,
  type BikeProfile,
  type BikeProfileId,
  type CrossingTurnOverride,
  DEFAULT_BIKES,
  DEFAULT_RULES_CONFIG,
  type LocalOverrides,
  type RulesConfiguration,
  type SemanticTurnType,
} from '../core/config';
import { LocalStorageProvider } from '../core/storage/storage';
import { useLatestRef } from './useLatestRef';

const storage = new LocalStorageProvider();
const BIKES_STORAGE_KEY = 'ciclista_bikes_v1';
const ACTIVE_BIKE_ID_STORAGE_KEY = 'ciclista_active_bike_id_v1';

function loadStoredBikes(): BikeProfile[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_BIKES;
  }
  try {
    const raw = localStorage.getItem(BIKES_STORAGE_KEY);
    if (!raw) return DEFAULT_BIKES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as BikeProfile[];
    }
  } catch {
    // fallback to defaults on corrupt storage
  }
  return DEFAULT_BIKES;
}

function loadStoredActiveBikeId(bikes: BikeProfile[]): string {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(ACTIVE_BIKE_ID_STORAGE_KEY);
      if (raw && bikes.some((b) => b.id === raw)) {
        return raw;
      }
    } catch {
      // fallback
    }
  }
  return bikes.some((b) => b.id === 'normal') ? 'normal' : (bikes[0]?.id ?? 'normal');
}

function bikeProfileToBikeConfig(profile: BikeProfile): BikeConfig {
  return {
    id: profile.id as BikeProfileId,
    customSpeedKmh: profile.speedKmh,
    weightKg: profile.weightKg,
    surfacePreferences: profile.surfacePreferences,
    turnPenalties: profile.turnPenalties,
  };
}

/**
 * React hook that coordinates local overrides state (delays, notes, custom routing rules, bike profiles)
 * with browser local storage and exposes unified save/clear methods.
 */
export function useOverrides() {
  const [nodeDelays, setNodeDelays] = useState<Map<string, number>>(new Map());
  const [nodeNotes, setNodeNotes] = useState<Map<string, string>>(new Map());
  const [nodeTurns, setNodeTurns] = useState<Map<string, Record<string, SemanticTurnType>>>(
    new Map(),
  );
  const [crossingTurns, setCrossingTurns] = useState<CrossingTurnOverride[]>([]);
  const [rulesConfig, setRulesConfig] = useState<RulesConfiguration>(() => {
    const saved = storage.loadRulesConfig();
    if (!saved) return DEFAULT_RULES_CONFIG;

    // Deep merge signs and roads to gracefully handle schema upgrades (e.g. comfort field).
    const mergedSigns = { ...DEFAULT_RULES_CONFIG.signs };
    if (saved.signs) {
      for (const k of Object.keys(saved.signs) as Array<keyof typeof saved.signs>) {
        if (mergedSigns[k]) {
          mergedSigns[k] = { ...mergedSigns[k], ...saved.signs[k] };
        }
      }
    }

    const mergedRoads = { ...DEFAULT_RULES_CONFIG.roads };
    if (saved.roads) {
      for (const k of Object.keys(saved.roads) as Array<keyof typeof saved.roads>) {
        if (mergedRoads[k]) {
          mergedRoads[k] = { ...mergedRoads[k], ...saved.roads[k] };
        }
      }
    }

    const mergedTurns = {
      ...DEFAULT_RULES_CONFIG.turns,
      ...(saved.turns ?? {}),
    };

    return {
      ...DEFAULT_RULES_CONFIG,
      ...saved,
      signs: mergedSigns,
      roads: mergedRoads,
      nodeDelays: { ...DEFAULT_RULES_CONFIG.nodeDelays, ...(saved.nodeDelays ?? {}) },
      turns: mergedTurns,
    };
  });
  const [bikes, setBikes] = useState<BikeProfile[]>(loadStoredBikes);
  const [activeBikeId, setActiveBikeId] = useState<string>(() => loadStoredActiveBikeId(bikes));

  const bikesRef = useLatestRef(bikes);
  const activeBikeIdRef = useLatestRef(activeBikeId);

  const [bikeConfig, setBikeConfig] = useState<BikeConfig>(() => {
    const initialBikes = loadStoredBikes();
    const initialActiveId = loadStoredActiveBikeId(initialBikes);
    const activeBike = initialBikes.find((b) => b.id === initialActiveId) ?? initialBikes[0];
    if (activeBike) {
      return bikeProfileToBikeConfig(activeBike);
    }
    return storage.loadBikeConfig() ?? { id: 'normal' };
  });

  // Persist bikes whenever changes occur
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(BIKES_STORAGE_KEY, JSON.stringify(bikes));
      } catch {
        // ignore
      }
    }
  }, [bikes]);

  // Persist activeBikeId whenever changes occur
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_BIKE_ID_STORAGE_KEY, activeBikeId);
      } catch {
        // ignore
      }
    }
  }, [activeBikeId]);

  const handleSetActiveBikeId = useCallback(
    (idOrUpdater: string | ((prev: string) => string)) => {
      const nextId =
        typeof idOrUpdater === 'function' ? idOrUpdater(activeBikeIdRef.current) : idOrUpdater;
      setActiveBikeId(nextId);
      const targetBike = bikesRef.current.find((b) => b.id === nextId) ?? bikesRef.current[0];
      if (targetBike) {
        setBikeConfig(bikeProfileToBikeConfig(targetBike));
      }
    },
    [activeBikeIdRef, bikesRef],
  );

  const addBike = useCallback((bike: BikeProfile) => {
    setBikes((prev) => [...prev, bike]);
  }, []);

  const updateBike = useCallback(
    (bikeOrId: BikeProfile | string, updates?: Partial<BikeProfile>) => {
      setBikes((prev) =>
        prev.map((b) => {
          if (typeof bikeOrId === 'string') {
            return b.id === bikeOrId ? { ...b, ...updates } : b;
          }
          return b.id === bikeOrId.id ? { ...b, ...bikeOrId } : b;
        }),
      );
      const updatedId = typeof bikeOrId === 'string' ? bikeOrId : bikeOrId.id;
      if (updatedId === activeBikeIdRef.current) {
        const currentActive = bikesRef.current.find((b) => b.id === updatedId);
        const merged =
          typeof bikeOrId === 'string'
            ? currentActive
              ? { ...currentActive, ...updates }
              : undefined
            : currentActive
              ? { ...currentActive, ...bikeOrId }
              : bikeOrId;
        if (merged) {
          setBikeConfig(bikeProfileToBikeConfig(merged));
        }
      }
    },
    [activeBikeIdRef, bikesRef],
  );

  const deleteBike = useCallback(
    (id: string) => {
      if (bikesRef.current.length <= 1) {
        return;
      }
      const remaining = bikesRef.current.filter((b) => b.id !== id);
      if (remaining.length === bikesRef.current.length) {
        return;
      }
      setBikes(remaining);
      if (activeBikeIdRef.current === id) {
        const nextActiveBike = remaining[0]!;
        setActiveBikeId(nextActiveBike.id);
        setBikeConfig(bikeProfileToBikeConfig(nextActiveBike));
      }
    },
    [activeBikeIdRef, bikesRef],
  );

  const loadCustomOverrides = async () => {
    const overrides = await storage.getOverrides();
    setNodeDelays(overrides.nodeDelays);
    setNodeNotes(overrides.nodeNotes);
    setNodeTurns(overrides.nodeTurns);
    setCrossingTurns(overrides.crossingTurns ?? []);
  };

  // Load custom settings on startup
  useEffect(() => {
    void Promise.resolve().then(loadCustomOverrides);
  }, []);

  // Persist rules config whenever it changes
  useEffect(() => {
    storage.saveRulesConfig(rulesConfig);
  }, [rulesConfig]);

  // Persist bike config whenever it changes
  useEffect(() => {
    storage.saveBikeConfig(bikeConfig);
  }, [bikeConfig]);

  const handleSaveNodeOverride = async (nodeId: string, delay: number, notes: string) => {
    await storage.saveNodeDelay(nodeId, delay);
    await storage.saveNodeNotes(nodeId, notes);
    await loadCustomOverrides();
  };

  const handleSaveNodeTurns = async (nodeId: string, turns: Record<string, SemanticTurnType>) => {
    await storage.saveNodeTurns(nodeId, turns);
    await loadCustomOverrides();
  };

  const handleClearNodeOverride = async (nodeId: string) => {
    await storage.clearNodeOverrides(nodeId);
    await loadCustomOverrides();
  };

  const handleSaveCrossingTurn = async (override: CrossingTurnOverride) => {
    await storage.saveCrossingTurn(override);
    await loadCustomOverrides();
  };

  const handleDeleteCrossingTurn = async (id: string) => {
    await storage.deleteCrossingTurn(id);
    await loadCustomOverrides();
  };

  const currentOverrides: LocalOverrides = useMemo(() => {
    return {
      nodeDelays,
      nodeNotes,
      nodeTurns,
      rulesConfig,
      bikeConfig,
      crossingTurns,
    };
  }, [nodeDelays, nodeNotes, nodeTurns, rulesConfig, bikeConfig, crossingTurns]);

  return {
    nodeDelays,
    nodeNotes,
    nodeTurns,
    crossingTurns,
    rulesConfig,
    setRulesConfig,
    bikeConfig,
    setBikeConfig,
    bikes,
    activeBikeId,
    setActiveBikeId: handleSetActiveBikeId,
    addBike,
    updateBike,
    deleteBike,
    currentOverrides,
    handleSaveNodeOverride,
    handleSaveNodeTurns,
    handleClearNodeOverride,
    handleSaveCrossingTurn,
    handleDeleteCrossingTurn,
  };
}
