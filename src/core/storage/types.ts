import type { RulesConfiguration } from '../router/types';

export type BikeProfile = 'slow' | 'normal' | 'ebike';

export interface LocalOverrides {
  nodeDelays: Map<string, number>;
  nodeNotes: Map<string, string>;
  nodeTurns: Map<string, Record<string, unknown>>;
  rulesConfig?: RulesConfiguration;
  bikeProfile?: BikeProfile;
}

export interface IStorageProvider {
  getOverrides(): Promise<LocalOverrides>;
  saveNodeDelay(nodeId: string, delaySeconds: number): Promise<void>;
  saveNodeNotes(nodeId: string, notes: string): Promise<void>;
  clearNodeOverrides(nodeId: string): Promise<void>;
}
