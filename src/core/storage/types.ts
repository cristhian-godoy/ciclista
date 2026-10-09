import type { CrossingTurnOverride, LocalOverrides, SemanticTurnType } from '../config';
import type { Landmark } from '../landmarks/types';

/**
 * Interface definition for storage providers managing the persistence of local routing overrides and landmarks.
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
}
