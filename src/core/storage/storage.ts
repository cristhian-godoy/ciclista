import type { IStorageProvider, LocalOverrides, RulesConfiguration } from '../types';

/**
 * An implementation of IStorageProvider that persists data in the browser's localStorage.
 * Safely falls back to an in-memory storage if localStorage is unavailable (e.g. SSR or test environments).
 */
export class LocalStorageProvider implements IStorageProvider {
  private STORAGE_KEY = 'ciclista_custom_nodes';
  private RULES_KEY = 'ciclista_rules_config';
  private inMemoryStorage = new Map<string, string>();

  private isLocalStorageAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null;
    } catch {
      return false;
    }
  }

  private getItem(key: string): string | null {
    if (this.isLocalStorageAvailable()) {
      return localStorage.getItem(key);
    }
    return this.inMemoryStorage.get(key) || null;
  }

  private setItem(key: string, value: string): void {
    if (this.isLocalStorageAvailable()) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.error('localStorage write failed:', e);
      }
    } else {
      this.inMemoryStorage.set(key, value);
    }
  }

  /**
   * Helper to load the raw JSON object from localStorage.
   */
  private loadRawData(): Record<string, { delay?: number; notes?: string; turns?: Record<string, unknown> }> {
    try {
      const data = this.getItem(this.STORAGE_KEY);
      if (!data) return {};
      const parsed = JSON.parse(data);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
      console.error('Failed to load overrides from localStorage:', e);
      return {};
    }
  }

  /**
   * Helper to save raw JSON object to localStorage.
   */
  private saveRawData(data: Record<string, { delay?: number; notes?: string; turns?: Record<string, unknown> }>): void {
    try {
      this.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save overrides to localStorage:', e);
    }
  }

  async getOverrides(): Promise<LocalOverrides> {
    const raw = this.loadRawData();
    const nodeDelays = new Map<string, number>();
    const nodeNotes = new Map<string, string>();
    const nodeTurns = new Map<string, Record<string, unknown>>();

    Object.entries(raw).forEach(([nodeId, item]) => {
      if (item && typeof item === 'object') {
        if (item.delay !== undefined && item.delay !== null) {
          const num = Number(item.delay);
          if (!isNaN(num)) {
            nodeDelays.set(nodeId, num);
          }
        }
        if (typeof item.notes === 'string') {
          nodeNotes.set(nodeId, item.notes);
        }
        if (item.turns && typeof item.turns === 'object') {
          nodeTurns.set(nodeId, item.turns);
        }
      }
    });

    return {
      nodeDelays,
      nodeNotes,
      nodeTurns,
    };
  }

  async saveNodeDelay(nodeId: string, delaySeconds: number): Promise<void> {
    const raw = this.loadRawData();
    if (!raw[nodeId] || typeof raw[nodeId] !== 'object') {
      raw[nodeId] = {};
    }
    raw[nodeId].delay = delaySeconds;
    this.saveRawData(raw);
  }

  async saveNodeNotes(nodeId: string, notes: string): Promise<void> {
    const raw = this.loadRawData();
    if (!raw[nodeId] || typeof raw[nodeId] !== 'object') {
      raw[nodeId] = {};
    }
    raw[nodeId].notes = notes;
    this.saveRawData(raw);
  }

  async clearNodeOverrides(nodeId: string): Promise<void> {
    const raw = this.loadRawData();
    if (raw[nodeId]) {
      delete raw[nodeId];
      this.saveRawData(raw);
    }
  }

  /** Persists the full rules configuration to localStorage. */
  saveRulesConfig(config: RulesConfiguration): void {
    try {
      this.setItem(this.RULES_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save rules config to localStorage:', e);
    }
  }

  /** Loads the persisted rules configuration, or returns null if none saved. */
  loadRulesConfig(): RulesConfiguration | null {
    try {
      const data = this.getItem(this.RULES_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return (parsed && typeof parsed === 'object') ? (parsed as RulesConfiguration) : null;
    } catch (e) {
      console.error('Failed to load rules config from localStorage:', e);
      return null;
    }
  }
}
