import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../config/settings';
import {
  exportSettingsJson,
  importSettingsJson,
  loadStoredSettings,
  resetStoredSettings,
  saveStoredSettings,
  SETTINGS_STORAGE_KEY,
} from './settingsStorage';

describe('settingsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads defaults when storage is empty', () => {
    const settings = loadStoredSettings();
    expect(settings).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('saves and loads round-trip settings', () => {
    saveStoredSettings({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
      freezePinsOnEditMode: false,
      dataSaver: true,
    });

    const loaded = loadStoredSettings();
    expect(loaded.theme).toBe('dark');
    expect(loaded.freezePinsOnEditMode).toBe(false);
    expect(loaded.dataSaver).toBe(true);
  });

  it('migrates from legacy ciclista_theme key if ciclista_settings does not exist', () => {
    localStorage.setItem('ciclista_theme', JSON.stringify('liberty'));
    const loaded = loadStoredSettings();
    expect(loaded.theme).toBe('liberty');
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('liberty');
  });

  it('exports and imports settings JSON cleanly', () => {
    const current = {
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark' as const,
      freezePinsOnEditMode: false,
    };
    const json = exportSettingsJson(current);
    expect(json).toContain('"theme": "dark"');

    const imported = importSettingsJson(json);
    expect(imported).not.toBeNull();
    expect(imported?.theme).toBe('dark');
    expect(imported?.freezePinsOnEditMode).toBe(false);
  });

  it('returns null when importing invalid JSON', () => {
    const imported = importSettingsJson('not-valid-json');
    expect(imported).toBeNull();
  });

  it('resets settings to defaults', () => {
    saveStoredSettings({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark',
      dataSaver: true,
    });
    const reset = resetStoredSettings();
    expect(reset).toEqual(DEFAULT_APP_SETTINGS);
    expect(loadStoredSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });
});
