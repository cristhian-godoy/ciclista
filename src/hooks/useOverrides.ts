import { useState, useEffect, useMemo } from 'react';
import type { LocalOverrides, BikeProfile } from '../core/storage/types';
import type { RulesConfiguration } from '../core/router/types';
import { LocalStorageProvider } from '../core/storage/storage';
import { DEFAULT_RULES_CONFIG } from '../components/RulesConfigPanel';

const storage = new LocalStorageProvider();

export function useOverrides() {
  const [nodeDelays, setNodeDelays] = useState<Map<string, number>>(new Map());
  const [nodeNotes, setNodeNotes] = useState<Map<string, string>>(new Map());
  const [nodeTurns, setNodeTurns] = useState<Map<string, Record<string, unknown>>>(new Map());
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

    return {
      ...DEFAULT_RULES_CONFIG,
      ...saved,
      signs: mergedSigns,
      roads: mergedRoads,
      nodeDelays: { ...DEFAULT_RULES_CONFIG.nodeDelays, ...(saved.nodeDelays ?? {}) },
    };
  });
  const [bikeProfile, setBikeProfile] = useState<BikeProfile>('normal');

  const loadCustomOverrides = async () => {
    const overrides = await storage.getOverrides();
    setNodeDelays(overrides.nodeDelays);
    setNodeNotes(overrides.nodeNotes);
    setNodeTurns(overrides.nodeTurns);
  };

  // Load custom settings on startup
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomOverrides();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Persist rules config whenever it changes
  useEffect(() => {
    storage.saveRulesConfig(rulesConfig);
  }, [rulesConfig]);

  const handleSaveNodeOverride = async (nodeId: string, delay: number, notes: string) => {
    await storage.saveNodeDelay(nodeId, delay);
    await storage.saveNodeNotes(nodeId, notes);
    await loadCustomOverrides();
  };

  const handleClearNodeOverride = async (nodeId: string) => {
    await storage.clearNodeOverrides(nodeId);
    await loadCustomOverrides();
  };

  const currentOverrides: LocalOverrides = useMemo(() => {
    return {
      nodeDelays,
      nodeNotes,
      nodeTurns,
      rulesConfig,
      bikeProfile,
    };
  }, [nodeDelays, nodeNotes, nodeTurns, rulesConfig, bikeProfile]);

  return {
    nodeDelays,
    nodeNotes,
    nodeTurns,
    rulesConfig,
    setRulesConfig,
    bikeProfile,
    setBikeProfile,
    currentOverrides,
    handleSaveNodeOverride,
    handleClearNodeOverride,
  };
}
