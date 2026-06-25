import type { LocalOverrides, SemanticTurnType } from '../config';

/**
 * Interface definition for storage providers managing the persistence of local routing overrides.
 */
export interface IStorageProvider {
  getOverrides(): Promise<LocalOverrides>;
  saveNodeDelay(nodeId: string, delaySeconds: number): Promise<void>;
  saveNodeNotes(nodeId: string, notes: string): Promise<void>;
  saveNodeTurns(nodeId: string, turns: Record<string, SemanticTurnType>): Promise<void>;
  clearNodeOverrides(nodeId: string): Promise<void>;
}
