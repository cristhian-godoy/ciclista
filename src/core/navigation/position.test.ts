import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Coordinate } from '../common/types';
import { createGeoProvider, createWASDProvider } from './position';

describe('Position Providers', () => {
  describe('createGeoProvider', () => {
    let originalGeolocation: Geolocation;
    let originalPermissions: Permissions | undefined;

    const mockWatchPosition = vi.fn();
    const mockClearWatch = vi.fn();
    const mockQuery = vi.fn();

    beforeEach(() => {
      originalGeolocation = navigator.geolocation;
      originalPermissions = navigator.permissions;

      mockWatchPosition.mockClear();
      mockClearWatch.mockClear();
      mockQuery.mockClear();

      // Setup geolocation mock
      const mockGeo = {
        watchPosition: mockWatchPosition,
        clearWatch: mockClearWatch,
      } as unknown as Geolocation;
      Object.defineProperty(navigator, 'geolocation', {
        value: mockGeo,
        configurable: true,
      });

      // Setup permissions mock
      const mockPerms = {
        query: mockQuery,
      } as unknown as Permissions;
      Object.defineProperty(navigator, 'permissions', {
        value: mockPerms,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true,
      });
      if (originalPermissions) {
        Object.defineProperty(navigator, 'permissions', {
          value: originalPermissions,
          configurable: true,
        });
      }
      vi.restoreAllMocks();
    });

    it('subscribes to geolocation watchPosition when permitted', async () => {
      mockQuery.mockResolvedValue({ state: 'granted' });
      mockWatchPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 48.8,
            longitude: 2.2,
            accuracy: 10,
            speed: 5,
          },
          timestamp: 12345,
        });
        return 1;
      });

      const provider = createGeoProvider();
      const posCallback = vi.fn();
      provider.onPosition(posCallback);

      provider.start();

      // Wait for permissions promise resolution
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockWatchPosition).toHaveBeenCalled();
      expect(posCallback).toHaveBeenCalledWith({ lat: 48.8, lng: 2.2 }, 12345, 5);

      provider.stop();
      expect(mockClearWatch).toHaveBeenCalledWith(1);
    });

    it('filters out low accuracy coordinates (> 50m)', async () => {
      mockQuery.mockResolvedValue({ state: 'granted' });
      mockWatchPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 48.8,
            longitude: 2.2,
            accuracy: 60, // bad accuracy
            speed: 5,
          },
          timestamp: 12345,
        });
        return 1;
      });

      const provider = createGeoProvider();
      const posCallback = vi.fn();
      provider.onPosition(posCallback);

      provider.start();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(posCallback).not.toHaveBeenCalled();
    });

    it('emits error if permission is denied', async () => {
      mockQuery.mockResolvedValue({ state: 'denied' });

      const provider = createGeoProvider();
      const errCallback = vi.fn();
      provider.onError(errCallback);

      provider.start();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(errCallback).toHaveBeenCalled();
      expect(mockWatchPosition).not.toHaveBeenCalled();
    });
  });

  describe('createWASDProvider', () => {
    let originalRequestAnimationFrame: typeof requestAnimationFrame;
    let originalCancelAnimationFrame: typeof cancelAnimationFrame;
    let rafCallback: FrameRequestCallback | null = null;
    let rafIdCounter = 0;

    beforeEach(() => {
      originalRequestAnimationFrame = window.requestAnimationFrame;
      originalCancelAnimationFrame = window.cancelAnimationFrame;
      rafCallback = null;
      rafIdCounter = 0;

      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallback = cb;
        return ++rafIdCounter;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
        rafCallback = null;
      });
    });

    afterEach(() => {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
      vi.restoreAllMocks();
    });

    it('tracks WASD key inputs and updates position', () => {
      const initial: Coordinate = { lat: 48.8584, lng: 2.2945 };
      const provider = createWASDProvider(initial);
      const posCallback = vi.fn();
      provider.onPosition(posCallback);

      provider.start();
      expect(rafCallback).toBeDefined();

      // Trigger 'W' key press
      const keydownW = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(keydownW);

      // Execute animation frame tick
      const now = performance.now();
      if (rafCallback) {
        rafCallback(now + 1000); // 1 second elapsed
      }

      expect(posCallback).toHaveBeenCalled();
      const firstCallCoord = posCallback.mock.calls[0][0];
      // Moving North: latitude should increase
      expect(firstCallCoord.lat).toBeGreaterThan(initial.lat);
      expect(firstCallCoord.lng).toBeCloseTo(initial.lng, 6);

      // Stop
      provider.stop();
      expect(rafCallback).toBeNull();
    });
  });
});
