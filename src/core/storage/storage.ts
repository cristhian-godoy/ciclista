import { logger } from '../common/logger';
import type { RulesConfiguration } from '../router/types';
import type { IStorageProvider, LocalOverrides } from './types';

/**
 * An implementation of IStorageProvider that persists data in the browser's localStorage.
 * Safely falls back to an in-memory storage if localStorage is unavailable (e.g. SSR or test environments).
 * Uses a debounced write queue and in-memory cache to prevent main-thread blocking UI stutter.
 */
export class LocalStorageProvider implements IStorageProvider {
  private STORAGE_KEY = 'ciclista_custom_nodes';
  private RULES_KEY = 'ciclista_rules_config';
  private inMemoryStorage = new Map<string, string>();

  // In-memory cache for overrides data to avoid parse/stringify on every operation
  private overridesCache: Record<
    string,
    { delay?: number; notes?: string; turns?: Record<string, unknown> }
  > | null = null;

  // Timer reference for the debounced write
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initializes the LocalStorageProvider and sets up beforeunload listener.
   */
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushPendingWrites();
      });
    }
  }

  private isLocalStorageAvailable(): boolean {
    try {
      return (
        typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null
      );
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
        logger.error('localStorage write failed:', e);
      }
    } else {
      this.inMemoryStorage.set(key, value);
    }
  }

  /**
   * Helper to load the raw JSON object from localStorage.
   */
  private loadRawData(): Record<
    string,
    { delay?: number; notes?: string; turns?: Record<string, unknown> }
  > {
    if (this.overridesCache !== null) {
      return this.overridesCache;
    }

    try {
      const data = this.getItem(this.STORAGE_KEY);
      if (!data) {
        this.overridesCache = {};
        return this.overridesCache;
      }
      const parsed = JSON.parse(data);
      this.overridesCache = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      logger.error('Failed to load overrides from localStorage:', e);
      this.overridesCache = {};
    }
    return this.overridesCache;
  }

  /**
   * Helper to save raw JSON object to localStorage with debouncing.
   */
  private saveRawData(
    data: Record<string, { delay?: number; notes?: string; turns?: Record<string, unknown> }>,
  ): void {
    // Keep cache updated immediately for synchronous in-memory read access
    this.overridesCache = data;

    // Clear previous timer
    if (this.writeTimer !== null) {
      clearTimeout(this.writeTimer);
    }

    // Schedule the write to localStorage
    this.writeTimer = setTimeout(() => {
      try {
        this.setItem(this.STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        logger.error('Failed to save overrides to localStorage:', e);
      }
      this.writeTimer = null;
    }, 200); // 200ms debounce
  }

  /**
   * Immediately writes any pending overrides to localStorage if a write is scheduled.
   */
  private flushPendingWrites(): void {
    if (this.writeTimer !== null && this.overridesCache !== null) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
      try {
        this.setItem(this.STORAGE_KEY, JSON.stringify(this.overridesCache));
      } catch (e) {
        logger.error('Failed to flush overrides to localStorage:', e);
      }
    }
  }

  /**
   * Retrieves all user-configured node overrides (delays, notes, and turns) from localStorage.
   */
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

  /**
   * Saves a custom crossing/intersection delay penalty for a specific node to localStorage.
   */
  async saveNodeDelay(nodeId: string, delaySeconds: number): Promise<void> {
    const raw = this.loadRawData();
    if (!raw[nodeId] || typeof raw[nodeId] !== 'object') {
      raw[nodeId] = {};
    }
    raw[nodeId].delay = delaySeconds;
    this.saveRawData(raw);
  }

  /**
   * Saves a custom descriptive node note/memo for a specific node to localStorage.
   */
  async saveNodeNotes(nodeId: string, notes: string): Promise<void> {
    const raw = this.loadRawData();
    if (!raw[nodeId] || typeof raw[nodeId] !== 'object') {
      raw[nodeId] = {};
    }
    raw[nodeId].notes = notes;
    this.saveRawData(raw);
  }

  /**
   * Removes all local storage overrides (delays and notes) associated with a specific node.
   */
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
      logger.error('Failed to save rules config to localStorage:', e);
    }
  }

  /** Loads the persisted rules configuration, or returns null if none saved. */
  loadRulesConfig(): RulesConfiguration | null {
    try {
      const data = this.getItem(this.RULES_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' ? (parsed as RulesConfiguration) : null;
    } catch (e) {
      logger.error('Failed to load rules config from localStorage:', e);
      return null;
    }
  }
}
