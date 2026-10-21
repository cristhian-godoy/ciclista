import type { BikeConfig, CrossingTurnOverride, LocalOverrides, SemanticTurnType } from '../config';
import type { MapEvent } from '../events';
import type { Landmark } from '../landmarks/types';

/**
 * Supported persistent application color theme modes.
 */
export type StoredTheme = 'bright' | 'liberty' | 'dark';

/**
 * Interface definition for storage providers managing the persistence of local routing overrides, landmarks, events, and app settings.
 */
export interface IStorageProvider {
  getOverrides(): Promise<LocalOverrides>;
  saveNodeDelay(nodeId: string, delaySeconds: number): Promise<void>;
  saveNodeNotes(nodeId: string, notes: string): Promise<void>;
  saveNodeTurns(nodeId: string, turns: Record<string, SemanticTurnType>): Promise<void>;
  clearNodeOverrides(nodeId: string): Promise<void>;
  getCrossingTurns(): Promise<CrossingTurnOverride[]>;
  saveCrossingTurn(override: CrossingTurnOverride): Promise<void>;
  deleteCrossingTurn(id: string): Promise<void>;
  clearCrossingTurns(crossingId?: string): Promise<void>;
  getLandmarks(): Promise<Landmark[]>;
  saveLandmarks(landmarks: Landmark[]): Promise<void>;
  getEvents(): Promise<MapEvent[]>;
  saveEvents(events: MapEvent[]): Promise<void>;
  loadBikeConfig(): BikeConfig | null;
  saveBikeConfig(config: BikeConfig): void;
  loadTheme(): StoredTheme | null;
  saveTheme(theme: string): void;
}
