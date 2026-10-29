import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../core/config/settings';
import { settingsStore, useSettings } from './settingsStore';

describe('settingsStore and useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    settingsStore.resetSettings();
  });

  it('initializes with default settings', () => {
    expect(settingsStore.getSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('updates settings and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = settingsStore.subscribe(listener);

    settingsStore.updateSettings({ freezePinsOnEditMode: false });

    expect(settingsStore.getSettings().freezePinsOnEditMode).toBe(false);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ freezePinsOnEditMode: false }));

    unsubscribe();
    settingsStore.updateSettings({ theme: 'dark' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('resets settings to defaults', () => {
    settingsStore.updateSettings({ theme: 'dark', dataSaver: true });
    expect(settingsStore.getSettings().theme).toBe('dark');

    settingsStore.resetSettings();
    expect(settingsStore.getSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('reactive useSettings hook synchronizes with store updates', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.theme).toBe('bright');

    act(() => {
      settingsStore.updateSettings({ theme: 'dark' });
    });

    expect(result.current.theme).toBe('dark');
  });
});
