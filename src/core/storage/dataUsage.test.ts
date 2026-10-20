import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addDataUsage,
  clearDataUsage,
  getConnectionType,
  getDataUsage,
  isCellularDownloadAllowed,
  isDataSaverActive,
  setCellularDownloadAllowed,
  setDataSaverActive,
} from './dataUsage';

describe('dataUsage storage module', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('getConnectionType', () => {
    it('returns unknown when connection API is unavailable', () => {
      expect(getConnectionType()).toBe('unknown');
    });

    it('identifies wifi connection type', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { type: 'wifi' },
        configurable: true,
      });
      expect(getConnectionType()).toBe('wifi');

      Object.defineProperty(navigator, 'connection', {
        value: { type: 'ethernet' },
        configurable: true,
      });
      expect(getConnectionType()).toBe('wifi');
    });

    it('identifies cellular connection type', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { type: 'cellular' },
        configurable: true,
      });
      expect(getConnectionType()).toBe('cellular');
    });
  });

  describe('data saver mode', () => {
    it('reads explicit setting from localStorage', () => {
      setDataSaverActive(true);
      expect(isDataSaverActive()).toBe(true);

      setDataSaverActive(false);
      expect(isDataSaverActive()).toBe(false);
    });

    it('falls back to connection saveData flag when not set in localStorage', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
        configurable: true,
      });
      expect(isDataSaverActive()).toBe(true);
    });

    it('falls back to true on cellular connection when not explicitly configured', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { type: 'cellular', saveData: false },
        configurable: true,
      });
      expect(isDataSaverActive()).toBe(true);
    });
  });

  describe('cellular download permissions', () => {
    it('toggles cellular download permissions', () => {
      expect(isCellularDownloadAllowed()).toBe(false);

      setCellularDownloadAllowed(true);
      expect(isCellularDownloadAllowed()).toBe(true);

      setCellularDownloadAllowed(false);
      expect(isCellularDownloadAllowed()).toBe(false);
    });
  });

  describe('data usage recording', () => {
    it('records cache usage correctly', () => {
      addDataUsage(1024, true);
      addDataUsage(2048, true);

      const stats = getDataUsage();
      expect(stats.cacheBytes).toBe(3072);
      expect(stats.wifiBytes).toBe(0);
      expect(stats.cellularBytes).toBe(0);
    });

    it('records network wifi usage when connection is wifi', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { type: 'wifi' },
        configurable: true,
      });

      addDataUsage(5000, false);
      const stats = getDataUsage();
      expect(stats.wifiBytes).toBe(5000);
      expect(stats.cellularBytes).toBe(0);
    });

    it('records network cellular usage when connection is cellular', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { type: 'cellular' },
        configurable: true,
      });

      addDataUsage(4000, false);
      const stats = getDataUsage();
      expect(stats.cellularBytes).toBe(4000);
      expect(stats.wifiBytes).toBe(0);
    });

    it('clears data usage stats', () => {
      addDataUsage(1000, true);
      addDataUsage(2000, false);

      clearDataUsage();
      const stats = getDataUsage();
      expect(stats.cacheBytes).toBe(0);
      expect(stats.wifiBytes).toBe(0);
      expect(stats.cellularBytes).toBe(0);
    });

    it('dispatches ciclista_data_usage_changed event', () => {
      const dispatchSpy = vi.spyOn(globalThis, 'dispatchEvent');
      addDataUsage(500, true);
      expect(dispatchSpy).toHaveBeenCalled();
    });
  });
});
