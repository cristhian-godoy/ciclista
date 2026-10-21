import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Coordinate } from '../core/common/types';
import type { RouteResult } from '../core/router/types';
import { useNavigation } from './useNavigation';

describe('useNavigation hook with continuous GPS tracking & wake lock', () => {
  const mockRoute: Coordinate[] = [
    { lat: 48.137, lng: 11.575 },
    { lat: 48.138, lng: 11.576 },
    { lat: 48.139, lng: 11.577 },
  ];

  const mockRouteResult: RouteResult = {
    pathNodeIds: ['n1', 'n2', 'n3'],
    coordinates: mockRoute,
    totalDurationSeconds: 120,
    totalDistanceMeters: 300,
    streets: ['Street A'],
    trafficSignalsCount: 0,
    yieldCount: 0,
    signalCount: 0,
    crossingCount: 0,
    roadTypeTotals: {},
    surfaceTotals: { paved: 300, gravel: 0, cobblestone: 0 },
  };

  let watchPositionSuccessCb: ((pos: GeolocationPosition) => void) | null = null;
  let watchPositionErrorCb: ((err: GeolocationPositionError) => void) | null = null;
  let clearWatchSpy: ReturnType<typeof vi.fn>;
  let wakeLockReleaseSpy: ReturnType<typeof vi.fn>;
  let wakeLockRequestSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    watchPositionSuccessCb = null;
    watchPositionErrorCb = null;

    clearWatchSpy = vi.fn();
    wakeLockReleaseSpy = vi.fn().mockResolvedValue(undefined);
    wakeLockRequestSpy = vi.fn().mockResolvedValue({
      release: wakeLockReleaseSpy,
    });

    // Mock navigator.geolocation
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition: vi.fn((success, error) => {
          watchPositionSuccessCb = success;
          watchPositionErrorCb = error;
          return 1234;
        }),
        clearWatch: clearWatchSpy,
      },
      writable: true,
      configurable: true,
    });

    // Mock navigator.wakeLock
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: wakeLockRequestSpy,
      },
      writable: true,
      configurable: true,
    });

    // Mock navigator.permissions
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: vi.fn().mockResolvedValue({
          state: 'granted',
          onchange: null,
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  it('initializes in idle status and queries permission', async () => {
    let hookResult: ReturnType<typeof renderHook<ReturnType<typeof useNavigation>, void>>['result'];
    await act(async () => {
      const rendered = renderHook(() =>
        useNavigation({ routeResult: mockRouteResult, routeCoordinates: mockRoute }),
      );
      hookResult = rendered.result;
    });

    expect(hookResult!.current.state.status).toBe('idle');
    expect(hookResult!.current.state.cameraMode).toBe('heading-up');
    expect(hookResult!.current.state.snapped).toBeNull();
  });

  it('starts continuous GPS tracking, requests screen WakeLock, and updates positions', async () => {
    const { result } = renderHook(() =>
      useNavigation({
        routeResult: mockRouteResult,
        routeCoordinates: mockRoute,
        defaultMode: 'gps',
      }),
    );

    await act(async () => {
      result.current.startNavigation('gps');
    });

    expect(result.current.state.status).toBe('active');
    expect(wakeLockRequestSpy).toHaveBeenCalledWith('screen');
    expect(navigator.geolocation.watchPosition).toHaveBeenCalled();

    // Simulate GPS coordinate emission
    await act(async () => {
      if (watchPositionSuccessCb) {
        watchPositionSuccessCb({
          coords: {
            latitude: 48.1375,
            longitude: 11.5755,
            accuracy: 5,
            altitude: null,
            altitudeAccuracy: null,
            heading: 45,
            speed: 5.5,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }
    });

    expect(result.current.state.raw).toEqual({ lat: 48.1375, lng: 11.5755 });
    expect(result.current.state.heading).toBe(45);
    expect(result.current.state.snapped).not.toBeNull();
  });

  it('handles geolocation errors gracefully and sets informative error message', async () => {
    const { result } = renderHook(() =>
      useNavigation({
        routeResult: mockRouteResult,
        routeCoordinates: mockRoute,
        defaultMode: 'gps',
      }),
    );

    await act(async () => {
      result.current.startNavigation('gps');
    });

    // Simulate permission denied error
    await act(async () => {
      if (watchPositionErrorCb) {
        watchPositionErrorCb({
          code: 1, // PERMISSION_DENIED
          message: 'User denied geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      }
    });

    expect(result.current.state.error).toContain('Location permission was denied');
    expect(result.current.state.permissionStatus).toBe('denied');
  });

  it('handles POSITION_UNAVAILABLE and TIMEOUT errors', async () => {
    const { result } = renderHook(() =>
      useNavigation({
        routeResult: mockRouteResult,
        routeCoordinates: mockRoute,
        defaultMode: 'gps',
      }),
    );

    await act(async () => {
      result.current.startNavigation('gps');
    });

    await act(async () => {
      if (watchPositionErrorCb) {
        watchPositionErrorCb({
          code: 2, // POSITION_UNAVAILABLE
          message: 'Signal lost',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      }
    });
    expect(result.current.state.error).toContain('currently unavailable');

    await act(async () => {
      if (watchPositionErrorCb) {
        watchPositionErrorCb({
          code: 3, // TIMEOUT
          message: 'Timeout',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      }
    });
    expect(result.current.state.error).toContain('timed out');
  });

  it('supports pausing and resuming active navigation', async () => {
    const { result } = renderHook(() =>
      useNavigation({
        routeResult: mockRouteResult,
        routeCoordinates: mockRoute,
        defaultMode: 'gps',
      }),
    );

    await act(async () => {
      result.current.startNavigation('gps');
    });
    expect(result.current.state.status).toBe('active');

    await act(async () => {
      result.current.pauseNavigation();
    });
    expect(result.current.state.status).toBe('paused');
    expect(wakeLockReleaseSpy).toHaveBeenCalled();

    await act(async () => {
      result.current.resumeNavigation();
    });
    expect(result.current.state.status).toBe('active');
  });

  it('toggles camera mode between heading-up and north-up', async () => {
    const { result } = renderHook(() =>
      useNavigation({
        routeResult: mockRouteResult,
        routeCoordinates: mockRoute,
      }),
    );

    expect(result.current.state.cameraMode).toBe('heading-up');

    await act(async () => {
      result.current.toggleCameraMode();
    });
    expect(result.current.state.cameraMode).toBe('north-up');

    await act(async () => {
      result.current.toggleCameraMode();
    });
    expect(result.current.state.cameraMode).toBe('heading-up');
  });

  it('detects route arrival at the destination coordinate and builds ride stats', async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useNavigation({
        routeResult: mockRouteResult,
        routeCoordinates: mockRoute,
        defaultMode: 'gps',
      }),
    );

    await act(async () => {
      result.current.startNavigation('gps');
    });

    // Emit final coordinate
    await act(async () => {
      if (watchPositionSuccessCb) {
        watchPositionSuccessCb({
          coords: {
            latitude: 48.139,
            longitude: 11.577,
            accuracy: 2,
            altitude: null,
            altitudeAccuracy: null,
            heading: 45,
            speed: 4.0,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.state.status).toBe('arrived');
    expect(result.current.rideStats).not.toBeNull();
    expect(result.current.rideStats?.totalDistanceM).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('stops navigation, clears watchPosition, and releases WakeLock', async () => {
    const { result } = renderHook(() =>
      useNavigation({
        routeResult: mockRouteResult,
        routeCoordinates: mockRoute,
        defaultMode: 'gps',
      }),
    );

    await act(async () => {
      result.current.startNavigation('gps');
    });

    await act(async () => {
      result.current.stopNavigation();
    });

    expect(result.current.state.status).toBe('idle');
    expect(clearWatchSpy).toHaveBeenCalledWith(1234);
    expect(wakeLockReleaseSpy).toHaveBeenCalled();
  });
});
