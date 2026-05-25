import type { RulesConfiguration } from '../router/types';

/**
 * Available bicycle routing profiles representing different riding speeds and preferences.
 */
export type BikeProfile = 'slow' | 'normal' | 'ebike' | 'road';

/**
 * Represents custom user configurations and overrides applied locally
 * to override default routing behaviors, node delays, notes, or rules configurations.
 */
export interface LocalOverrides {
  nodeDelays: Map<string, number>;
  nodeNotes: Map<string, string>;
  nodeTurns: Map<string, Record<string, unknown>>;
  rulesConfig?: RulesConfiguration;
  bikeProfile?: BikeProfile;
}

/**
 * Interface definition for storage providers managing the persistence of local routing overrides.
 */
export interface IStorageProvider {
  getOverrides(): Promise<LocalOverrides>;
  saveNodeDelay(nodeId: string, delaySeconds: number): Promise<void>;
  saveNodeNotes(nodeId: string, notes: string): Promise<void>;
  clearNodeOverrides(nodeId: string): Promise<void>;
}
