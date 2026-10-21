import { logger } from '../common/logger';
import type {
  BikeConfig,
  BikeProfileId,
  CrossingTurnOverride,
  LocalOverrides,
  RulesConfiguration,
  SemanticTurnType,
} from '../config';
import type { MapEvent } from '../events';
import { deserializeLandmarks, serializeLandmarks } from '../landmarks/landmarks';
import type { Landmark } from '../landmarks/types';
import type { IStorageProvider, StoredTheme } from './types';

/**
 * An implementation of IStorageProvider that persists data in the browser's localStorage.
 * Safely falls back to an in-memory storage if localStorage is unavailable (e.g. SSR or test environments).
 * Uses a debounced write queue and in-memory cache to prevent main-thread blocking UI stutter.
 */
export class LocalStorageProvider implements IStorageProvider {
  private STORAGE_KEY = 'ciclista_custom_nodes';
  private RULES_KEY = 'ciclista_rules_config';
  private LANDMARKS_KEY = 'ciclista_landmarks';
  private CROSSING_TURNS_KEY = 'ciclista_crossing_turns';
  private EVENTS_KEY = 'ciclista_events';
  private BIKE_CONFIG_KEY = 'ciclista_bike_config';
  private THEME_KEY = 'ciclista_theme';
  private inMemoryStorage = new Map<string, string>();

  // In-memory cache for overrides data to avoid parse/stringify on every operation
  private overridesCache: Record<
    string,
    { delay?: number; notes?: string; turns?: Record<string, SemanticTurnType> }
  > | null = null;

  // Timer reference for the debounced write
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initializes the LocalStorageProvider and sets up beforeunload listener.
   */
  constructor() {
    if (typeof globalThis !== 'undefined' && 'addEventListener' in globalThis) {
      globalThis.addEventListener('beforeunload', () => {
        this.flushPendingWrites();
      });
    }
  }

  private isLocalStorageAvailable(): boolean {
    try {
      return (
        typeof globalThis !== 'undefined' &&
        'localStorage' in globalThis &&
        globalThis.localStorage !== null
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
    { delay?: number; notes?: string; turns?: Record<string, SemanticTurnType> }
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
    return this.overridesCache || {};
  }

  /**
   * Helper to save raw JSON object to localStorage with debouncing.
   */
  private saveRawData(
    data: Record<
      string,
      { delay?: number; notes?: string; turns?: Record<string, SemanticTurnType> }
    >,
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
    const nodeTurns = new Map<string, Record<string, SemanticTurnType>>();

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

    const crossingTurns = this.loadCrossingTurnsSync();

    return {
      nodeDelays,
      nodeNotes,
      nodeTurns,
      crossingTurns,
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
   * Saves custom turn overrides for a specific node to localStorage.
   */
  async saveNodeTurns(nodeId: string, turns: Record<string, SemanticTurnType>): Promise<void> {
    const raw = this.loadRawData();
    if (!raw[nodeId] || typeof raw[nodeId] !== 'object') {
      raw[nodeId] = {};
    }
    raw[nodeId].turns = turns;
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

  /**
   * Retrieves all user-defined landmarks from localStorage.
   * Discards malformed records safely.
   */
  async getLandmarks(): Promise<Landmark[]> {
    return this.loadLandmarksSync();
  }

  /**
   * Synchronously loads all user-defined landmarks from localStorage.
   */
  loadLandmarksSync(): Landmark[] {
    const raw = this.getItem(this.LANDMARKS_KEY);
    if (!raw) return [];
    return deserializeLandmarks(raw);
  }

  /**
   * Persists the collection of user-defined landmarks to localStorage.
   *
   * @param landmarks - Array of landmarks to save.
   */
  async saveLandmarks(landmarks: Landmark[]): Promise<void> {
    try {
      this.setItem(this.LANDMARKS_KEY, serializeLandmarks(landmarks));
    } catch (e) {
      logger.error('Failed to save landmarks to localStorage:', e);
    }
  }

  /**
   * Retrieves all user-configured crossing turn overrides from localStorage.
   */
  async getCrossingTurns(): Promise<CrossingTurnOverride[]> {
    return this.loadCrossingTurnsSync();
  }

  /**
   * Synchronously loads all user-configured crossing turn overrides from localStorage.
   */
  loadCrossingTurnsSync(): CrossingTurnOverride[] {
    const raw = this.getItem(this.CROSSING_TURNS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item) =>
            item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.crossingId === 'string' &&
            typeof item.fromNodeId === 'string' &&
            typeof item.toNodeId === 'string',
        ) as CrossingTurnOverride[];
      }
    } catch (e) {
      logger.error('Failed to parse crossing turns from localStorage:', e);
    }
    return [];
  }

  /**
   * Saves a crossing turn override to localStorage. Updates existing override by id or appends.
   */
  async saveCrossingTurn(override: CrossingTurnOverride): Promise<void> {
    const existing = this.loadCrossingTurnsSync();
    const index = existing.findIndex((t) => t.id === override.id);
    if (index >= 0) {
      existing[index] = override;
    } else {
      existing.push(override);
    }
    try {
      this.setItem(this.CROSSING_TURNS_KEY, JSON.stringify(existing));
    } catch (e) {
      logger.error('Failed to save crossing turn to localStorage:', e);
    }
  }

  /**
   * Persists an array of crossing turn overrides directly to localStorage.
   */
  async saveCrossingTurns(overrides: CrossingTurnOverride[]): Promise<void> {
    try {
      this.setItem(this.CROSSING_TURNS_KEY, JSON.stringify(overrides));
    } catch (e) {
      logger.error('Failed to save crossing turns to localStorage:', e);
    }
  }

  /**
   * Deletes a crossing turn override by its unique identifier.
   */
  async deleteCrossingTurn(id: string): Promise<void> {
    const existing = this.loadCrossingTurnsSync();
    const filtered = existing.filter((t) => t.id !== id);
    try {
      this.setItem(this.CROSSING_TURNS_KEY, JSON.stringify(filtered));
    } catch (e) {
      logger.error('Failed to delete crossing turn from localStorage:', e);
    }
  }

  /**
   * Clears all crossing turn overrides, optionally filtered by crossing cluster id.
   */
  async clearCrossingTurns(crossingId?: string): Promise<void> {
    if (!crossingId) {
      try {
        this.setItem(this.CROSSING_TURNS_KEY, JSON.stringify([]));
      } catch (e) {
        logger.error('Failed to clear crossing turns from localStorage:', e);
      }
      return;
    }
    const existing = this.loadCrossingTurnsSync();
    const filtered = existing.filter((t) => t.crossingId !== crossingId);
    try {
      this.setItem(this.CROSSING_TURNS_KEY, JSON.stringify(filtered));
    } catch (e) {
      logger.error('Failed to clear crossing turns for cluster from localStorage:', e);
    }
  }

  /**
   * Retrieves all persisted map events from localStorage.
   */
  async getEvents(): Promise<MapEvent[]> {
    return this.loadEventsSync();
  }

  /**
   * Synchronously loads and migrates map events from localStorage with schema fallbacks.
   */
  loadEventsSync(): MapEvent[] {
    const raw = this.getItem(this.EVENTS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const validEvents: MapEvent[] = [];
      parsed.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const record = item as Partial<MapEvent>;
        const id =
          typeof record.id === 'string' && record.id.trim() !== ''
            ? record.id
            : `event-${Date.now()}-${idx}`;
        const name = typeof record.name === 'string' ? record.name : 'Custom Event';
        const description = typeof record.description === 'string' ? record.description : undefined;
        const active = typeof record.active === 'boolean' ? record.active : true;
        const edgeIds = Array.isArray(record.edgeIds)
          ? record.edgeIds.filter((idItem): idItem is string => typeof idItem === 'string')
          : [];
        const effect =
          record.effect &&
          typeof record.effect === 'object' &&
          record.effect.type === 'road_blockage'
            ? {
                type: 'road_blockage' as const,
                penaltySeconds:
                  typeof record.effect.penaltySeconds === 'number' &&
                  !isNaN(record.effect.penaltySeconds)
                    ? record.effect.penaltySeconds
                    : 30,
              }
            : { type: 'road_blockage' as const, penaltySeconds: 30 };
        const createdAt =
          typeof record.createdAt === 'number' && !isNaN(record.createdAt)
            ? record.createdAt
            : Date.now();

        validEvents.push({
          id,
          name,
          description,
          active,
          edgeIds,
          effect,
          createdAt,
        });
      });

      return validEvents;
    } catch (e) {
      logger.error('Failed to parse events from localStorage:', e);
      return [];
    }
  }

  /**
   * Asynchronously persists the list of map events to localStorage.
   */
  async saveEvents(events: MapEvent[]): Promise<void> {
    this.saveEventsSync(events);
  }

  /**
   * Synchronously persists the list of map events to localStorage.
   */
  saveEventsSync(events: MapEvent[]): void {
    try {
      this.setItem(this.EVENTS_KEY, JSON.stringify(events));
    } catch (e) {
      logger.error('Failed to save events to localStorage:', e);
    }
  }

  /**
   * Loads and migrates user bike profile and configuration with default fallbacks.
   */
  loadBikeConfig(): BikeConfig | null {
    const raw = this.getItem(this.BIKE_CONFIG_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      const validProfiles: BikeProfileId[] = ['slow', 'normal', 'ebike', 'road', 'custom'];
      const id: BikeProfileId = validProfiles.includes(parsed.id) ? parsed.id : 'normal';

      const config: BikeConfig = { id };

      if (typeof parsed.customSpeedKmh === 'number' && parsed.customSpeedKmh > 0) {
        config.customSpeedKmh = parsed.customSpeedKmh;
      }

      const weightVal = parsed.weightKg ?? parsed.weight;
      if (typeof weightVal === 'number' && weightVal > 0) {
        config.weightKg = weightVal;
      }

      if (parsed.surfacePreferences && typeof parsed.surfacePreferences === 'object') {
        const sp = parsed.surfacePreferences;
        config.surfacePreferences = {
          gravelSpeedMultiplier:
            typeof sp.gravelSpeedMultiplier === 'number' ? sp.gravelSpeedMultiplier : undefined,
          gravelFlatPenalty:
            typeof sp.gravelFlatPenalty === 'number' ? sp.gravelFlatPenalty : undefined,
          cobblestoneSpeedMultiplier:
            typeof sp.cobblestoneSpeedMultiplier === 'number'
              ? sp.cobblestoneSpeedMultiplier
              : undefined,
          cobblestoneFlatPenalty:
            typeof sp.cobblestoneFlatPenalty === 'number' ? sp.cobblestoneFlatPenalty : undefined,
        };
      }

      if (parsed.turnPenalties && typeof parsed.turnPenalties === 'object') {
        const tp = parsed.turnPenalties;
        config.turnPenalties = {
          rightTurnPenaltySeconds:
            typeof tp.rightTurnPenaltySeconds === 'number' ? tp.rightTurnPenaltySeconds : undefined,
          leftTurnPenaltySeconds:
            typeof tp.leftTurnPenaltySeconds === 'number' ? tp.leftTurnPenaltySeconds : undefined,
          uTurnPenaltySeconds:
            typeof tp.uTurnPenaltySeconds === 'number' ? tp.uTurnPenaltySeconds : undefined,
        };
      }

      return config;
    } catch (e) {
      logger.error('Failed to parse bike config from localStorage:', e);
      return null;
    }
  }

  /**
   * Persists user bike profile and preference settings to localStorage.
   */
  saveBikeConfig(config: BikeConfig): void {
    try {
      this.setItem(this.BIKE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      logger.error('Failed to save bike config to localStorage:', e);
    }
  }

  /**
   * Loads the persisted theme, migrating legacy theme strings if needed.
   */
  loadTheme(): StoredTheme | null {
    let raw = this.getItem(this.THEME_KEY);
    if (!raw) return null;

    if (raw.startsWith('"') && raw.endsWith('"')) {
      try {
        raw = JSON.parse(raw);
      } catch {
        // use raw as-is
      }
    }

    if (raw === 'light') {
      return 'bright';
    }
    if (raw === 'bright' || raw === 'liberty' || raw === 'dark') {
      return raw;
    }
    return null;
  }

  /**
   * Persists application color theme setting to localStorage.
   */
  saveTheme(theme: string): void {
    try {
      this.setItem(this.THEME_KEY, theme);
    } catch (e) {
      logger.error('Failed to save theme to localStorage:', e);
    }
  }
}
