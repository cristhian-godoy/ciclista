import { describe, expect, it } from 'vitest';

import { DEFAULT_APP_SETTINGS } from './settings';
import {
  getSettingMetadata,
  searchSettings,
  SETTING_CATEGORY_MAP,
  SETTINGS_METADATA,
} from './settingsMetadata';

describe('settingsMetadata', () => {
  it('defines metadata for all keys present in DEFAULT_APP_SETTINGS', () => {
    const defaultKeys = Object.keys(DEFAULT_APP_SETTINGS) as (keyof typeof DEFAULT_APP_SETTINGS)[];
    const metadataKeys = SETTINGS_METADATA.map((m) => m.key);

    for (const key of defaultKeys) {
      expect(metadataKeys).toContain(key);
      expect(SETTING_CATEGORY_MAP[key]).toBeDefined();
    }
  });

  it('retrieves individual metadata via getSettingMetadata', () => {
    const themeMeta = getSettingMetadata('theme');
    expect(themeMeta).toBeDefined();
    expect(themeMeta?.category).toBe('appearance');
    expect(themeMeta?.type).toBe('enum');
    expect(themeMeta?.options?.length).toBe(3);

    const freezeMeta = getSettingMetadata('freezePinsOnEditMode');
    expect(freezeMeta).toBeDefined();
    expect(freezeMeta?.category).toBe('map');
    expect(freezeMeta?.type).toBe('boolean');
    expect(freezeMeta?.defaultValue).toBe(true);
  });

  it('searches settings by key, title, category, description, and keywords', () => {
    // Empty search returns all metadata
    expect(searchSettings('').length).toBe(SETTINGS_METADATA.length);

    // Search by key
    const themeSearch = searchSettings('theme');
    expect(themeSearch.some((s) => s.key === 'theme')).toBe(true);

    // Search by keyword
    const freezeSearch = searchSettings('lock');
    expect(freezeSearch.some((s) => s.key === 'freezePinsOnEditMode')).toBe(true);

    // Search by category
    const mapSearch = searchSettings('map');
    expect(mapSearch.length).toBeGreaterThan(0);
    expect(
      mapSearch.every(
        (s) =>
          s.category === 'map' ||
          s.description.toLowerCase().includes('map') ||
          s.keywords?.some((k) => k.toLowerCase().includes('map')),
      ),
    ).toBe(true);
  });
});
