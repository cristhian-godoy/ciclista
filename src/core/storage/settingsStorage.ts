import { logger } from '../common/logger';
import { type AppSettings, DEFAULT_APP_SETTINGS, type RoutingStrategyId } from '../config/settings';
import type { BikeProfileId } from '../config/types';

/** Storage key used for persisted application settings */
export const SETTINGS_STORAGE_KEY = 'ciclista_settings';

/** Legacy theme key for migration */
const LEGACY_THEME_KEY = 'ciclista_theme';

const memoryStore = new Map<string, string>();

/**
 * Checks whether global localStorage is accessible in current execution context.
 *
 * @returns True if localStorage is usable, false otherwise.
 */
function isLocalStorageAvailable(): boolean {
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

/**
 * Safely reads a raw string item from storage.
 *
 * @param key - Storage item key.
 * @returns The raw string value or null.
 */
function getStorageItem(key: string): string | null {
  if (isLocalStorageAvailable()) {
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  return memoryStore.get(key) ?? null;
}

/**
 * Safely writes a raw string item into storage.
 *
 * @param key - Storage item key.
 * @param value - String value to persist.
 */
function setStorageItem(key: string, value: string): void {
  if (isLocalStorageAvailable()) {
    try {
      globalThis.localStorage.setItem(key, value);
      return;
    } catch (e) {
      logger.error('Failed writing to localStorage:', e);
    }
  }
  memoryStore.set(key, value);
}

/**
 * Validates and merges an untrusted partial settings object with defaults.
 *
 * @param parsed - Untrusted parsed object from storage or JSON import.
 * @returns Valid AppSettings object conforming to domain schema.
 */
function sanitizeSettings(parsed: Record<string, unknown>): AppSettings {
  const validThemes: AppSettings['theme'][] = ['bright', 'liberty', 'dark'];
  const validBikeProfiles: BikeProfileId[] = ['slow', 'normal', 'ebike', 'road', 'custom'];
  const validRoutingStrategies: RoutingStrategyId[] = ['balanced', 'fastest', 'safe', 'scenic'];

  const theme = validThemes.includes(parsed.theme as AppSettings['theme'])
    ? (parsed.theme as AppSettings['theme'])
    : DEFAULT_APP_SETTINGS.theme;

  const freezePinsOnEditMode =
    typeof parsed.freezePinsOnEditMode === 'boolean'
      ? parsed.freezePinsOnEditMode
      : DEFAULT_APP_SETTINGS.freezePinsOnEditMode;

  const autoCollapseCrossingClusters =
    typeof parsed.autoCollapseCrossingClusters === 'boolean'
      ? parsed.autoCollapseCrossingClusters
      : DEFAULT_APP_SETTINGS.autoCollapseCrossingClusters;

  const showStreetGraph =
    typeof parsed.showStreetGraph === 'boolean'
      ? parsed.showStreetGraph
      : DEFAULT_APP_SETTINGS.showStreetGraph;

  const showTrafficSignals =
    typeof parsed.showTrafficSignals === 'boolean'
      ? parsed.showTrafficSignals
      : DEFAULT_APP_SETTINGS.showTrafficSignals;

  const dataSaver =
    typeof parsed.dataSaver === 'boolean' ? parsed.dataSaver : DEFAULT_APP_SETTINGS.dataSaver;

  const allowCellularDownloads =
    typeof parsed.allowCellularDownloads === 'boolean'
      ? parsed.allowCellularDownloads
      : DEFAULT_APP_SETTINGS.allowCellularDownloads;

  const defaultBikeProfile = validBikeProfiles.includes(parsed.defaultBikeProfile as BikeProfileId)
    ? (parsed.defaultBikeProfile as BikeProfileId)
    : DEFAULT_APP_SETTINGS.defaultBikeProfile;

  const defaultRoutingStrategy = validRoutingStrategies.includes(
    parsed.defaultRoutingStrategy as RoutingStrategyId,
  )
    ? (parsed.defaultRoutingStrategy as RoutingStrategyId)
    : DEFAULT_APP_SETTINGS.defaultRoutingStrategy;

  return {
    theme,
    freezePinsOnEditMode,
    autoCollapseCrossingClusters,
    showStreetGraph,
    showTrafficSignals,
    dataSaver,
    allowCellularDownloads,
    defaultBikeProfile,
    defaultRoutingStrategy,
  };
}

/**
 * Loads persisted application settings from storage with automatic migration from legacy keys.
 *
 * @returns Deserialized AppSettings merged with defaults.
 */
export function loadStoredSettings(): AppSettings {
  const raw = getStorageItem(SETTINGS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return sanitizeSettings(parsed as Record<string, unknown>);
      }
    } catch (e) {
      logger.warn('Failed parsing stored ciclista_settings, falling back to defaults:', e);
    }
  }

  // Attempt migration from legacy individual keys (e.g. ciclista_theme)
  const legacyTheme = getStorageItem(LEGACY_THEME_KEY);
  if (legacyTheme) {
    try {
      const themeCandidate = legacyTheme.replace(/^"|"$/g, '');
      if (
        themeCandidate === 'bright' ||
        themeCandidate === 'liberty' ||
        themeCandidate === 'dark'
      ) {
        const migrated: AppSettings = {
          ...DEFAULT_APP_SETTINGS,
          theme: themeCandidate,
        };
        saveStoredSettings(migrated);
        return migrated;
      }
    } catch {
      // Ignore migration errors
    }
  }

  return { ...DEFAULT_APP_SETTINGS };
}

/**
 * Persists application settings to storage.
 *
 * @param settings - AppSettings object to serialize and save.
 */
export function saveStoredSettings(settings: AppSettings): void {
  try {
    const serialized = JSON.stringify(settings);
    setStorageItem(SETTINGS_STORAGE_KEY, serialized);
  } catch (e) {
    logger.error('Failed saving ciclista_settings:', e);
  }
}

/**
 * Serializes current settings to a formatted JSON string for export/backup.
 *
 * @param settings - Settings to export.
 * @returns Formatted JSON string.
 */
export function exportSettingsJson(settings: AppSettings): string {
  return JSON.stringify(settings, null, 2);
}

/**
 * Parses and validates an imported JSON configuration string.
 *
 * @param jsonString - Raw JSON string to import.
 * @returns Sanitized AppSettings or null if JSON is invalid.
 */
export function importSettingsJson(jsonString: string): AppSettings | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === 'object') {
      const sanitized = sanitizeSettings(parsed as Record<string, unknown>);
      saveStoredSettings(sanitized);
      return sanitized;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resets application settings to system defaults in storage.
 *
 * @returns Reset default AppSettings.
 */
export function resetStoredSettings(): AppSettings {
  const defaults = { ...DEFAULT_APP_SETTINGS };
  saveStoredSettings(defaults);
  return defaults;
}
