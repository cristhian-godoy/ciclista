import { useSyncExternalStore } from 'react';

import { type AppSettings, DEFAULT_APP_SETTINGS } from '../core/config/settings';
import {
  loadStoredSettings,
  resetStoredSettings,
  saveStoredSettings,
} from '../core/storage/settingsStorage';

/**
 * Listener callback fired when settings state mutates.
 */
export type SettingsListener = (settings: AppSettings) => void;

/**
 * Decoupled reactive store managing application settings preferences and storage synchronization.
 */
export class SettingsStore {
  private settings: AppSettings;
  private listeners = new Set<SettingsListener>();

  /**
   * Initializes the settings store from persistent storage.
   */
  constructor() {
    this.settings = loadStoredSettings();
  }

  /**
   * Retrieves the current snapshot of application settings.
   *
   * @returns Current AppSettings snapshot.
   */
  getSettings(): AppSettings {
    return this.settings;
  }

  /**
   * Alias for getSettings for useSyncExternalStore snapshot contract.
   *
   * @returns Current AppSettings snapshot.
   */
  getSnapshot(): AppSettings {
    return this.settings;
  }

  /**
   * Updates partial application settings and persists changes to storage.
   *
   * @param newSettings - Subset of settings to update.
   */
  updateSettings(newSettings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    saveStoredSettings(this.settings);
    this.notify();
  }

  /**
   * Resets all application settings to system defaults and notifies listeners.
   */
  resetSettings(): void {
    this.settings = resetStoredSettings();
    this.notify();
  }

  /**
   * Subscribes a listener to settings updates.
   *
   * @param listener - Callback function invoked on settings changes.
   * @returns Unsubscribe teardown function.
   */
  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.settings);
    }
  }
}

/**
 * Singleton reactive settings store instance.
 */
export const settingsStore = new SettingsStore();

/**
 * Custom React hook to consume global application settings reactively.
 *
 * @returns Current AppSettings state.
 */
export function useSettings(): AppSettings {
  return useSyncExternalStore(
    (cb) => settingsStore.subscribe(cb),
    () => settingsStore.getSnapshot(),
    () => DEFAULT_APP_SETTINGS,
  );
}
