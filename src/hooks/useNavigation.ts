import { useCallback, useEffect, useRef, useState } from 'react';

import type { Coordinate } from '../core/common/types';
import {
  buildRideStats,
  calculateBearing,
  computeProgress,
  extractDeviceOrientationHeading,
  interpolatePosition,
  snapToRoute,
} from '../core/navigation/engine';
import { createPositionProvider } from '../core/navigation/position';
import type { NavigationProgress, NavigationState, RideStats } from '../core/navigation/types';
import type { RouteResult } from '../core/router/types';

interface UseNavigationProps {
  routeResult: RouteResult | null;
  routeCoordinates: Coordinate[];
  defaultMode?: 'gps' | 'dev';
}

/**
 * Custom hook orchestrating turn-by-turn navigation state, continuous GPS tracking,
 * heading/orientation updates, wake lock management, and error handling.
 */
export function useNavigation({ routeResult, routeCoordinates, defaultMode }: UseNavigationProps) {
  const [state, setState] = useState<NavigationState>({
    status: 'idle',
    cameraMode: 'heading-up',
    snapped: null,
    raw: null,
    progress: null,
    routeCoordinates: [],
    startTimestamp: null,
    heading: null,
    error: null,
    permissionStatus: null,
  });

  const [rideStats, setRideStats] = useState<RideStats | null>(null);

  const providerRef = useRef<ReturnType<typeof createPositionProvider> | null>(null);
  const lastSnappedRef = useRef<ReturnType<typeof snapToRoute> | null>(null);
  const maxSpeedKmhRef = useRef<number>(0);
  const accumulatedTimeSecondsRef = useRef<number>(0);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  // Acquire WakeLock to keep screen on during active navigation
  const acquireWakeLock = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        const sentinel = await (
          navigator as unknown as {
            wakeLock: { request: (type: string) => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock.request('screen');
        wakeLockRef.current = sentinel;
      } catch {
        // WakeLock request can fail due to battery saver or policy
      }
    }
  }, []);

  // Release active WakeLock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore errors during release
      }
      wakeLockRef.current = null;
    }
  }, []);

  // Check initial geolocation permissions
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((perm) => {
          setState((prev) => ({
            ...prev,
            permissionStatus: perm.state as 'prompt' | 'granted' | 'denied',
          }));
          perm.onchange = () => {
            setState((prev) => ({
              ...prev,
              permissionStatus: perm.state as 'prompt' | 'granted' | 'denied',
            }));
          };
        })
        .catch(() => {
          // Permissions API might not support geolocation query on older browsers
        });
    }
  }, []);

  // Handle re-acquiring wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && state.status === 'active') {
        void acquireWakeLock();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [state.status, acquireWakeLock]);

  // Handle device orientation events for heading updates
  useEffect(() => {
    if (state.status !== 'active' || typeof window === 'undefined') return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const webkitHeading = (e as unknown as { webkitCompassHeading?: number })
        .webkitCompassHeading;
      const compassHeading = extractDeviceOrientationHeading(e.alpha, webkitHeading);
      if (compassHeading !== null) {
        setState((curr) => {
          if (curr.status !== 'active') return curr;
          return { ...curr, heading: compassHeading };
        });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [state.status]);

  const startNavigation = (overrideMode?: 'gps' | 'dev') => {
    if (routeCoordinates.length === 0 || !routeResult) return;

    // Cleanup previous provider if any
    providerRef.current?.stop();
    void releaseWakeLock();

    const mode = overrideMode ?? defaultMode ?? (import.meta.env.DEV ? 'dev' : 'gps');
    const initialCoord = routeCoordinates[0];
    if (!initialCoord) return;
    const provider = createPositionProvider(mode, initialCoord);
    providerRef.current = provider;

    maxSpeedKmhRef.current = 0;
    lastSnappedRef.current = null;
    accumulatedTimeSecondsRef.current = 0;
    setRideStats(null);

    const startTimestamp = Date.now();

    const secondCoord = routeCoordinates[1];
    const initialBearing =
      routeCoordinates.length > 1 && secondCoord ? calculateBearing(initialCoord, secondCoord) : 0;

    const initialSnapped = {
      coordinate: initialCoord,
      bearing: initialBearing,
      segmentIndex: 0,
      fractionAlongSegment: 0,
      distanceFromRawM: 0,
    };

    const initialProgress: NavigationProgress = {
      distanceCoveredM: 0,
      distanceRemainingM: routeResult.totalDistanceMeters,
      etaSeconds: routeResult.totalDurationSeconds,
      elapsedSeconds: 0,
      averageSpeedKmh: 0,
      currentSpeedKmh: 0,
    };

    setState((prev) => ({
      status: 'active',
      cameraMode: prev.cameraMode,
      snapped: initialSnapped,
      raw: initialCoord,
      progress: initialProgress,
      routeCoordinates,
      startTimestamp,
      heading: initialBearing,
      error: null,
    }));

    void acquireWakeLock();

    provider.onPosition((coord, timestamp, speedKmh = 0, gpsHeading = null) => {
      setState((curr) => {
        if (curr.status !== 'active') return curr;

        const currentStart = curr.startTimestamp ?? Date.now();
        const hint = lastSnappedRef.current
          ? { lastSegmentIndex: lastSnappedRef.current.segmentIndex }
          : undefined;

        // 1. Snap to Route
        const snapped = snapToRoute(coord, routeCoordinates, hint);

        // 2. Interpolate Position
        let smoothed = snapped;
        if (lastSnappedRef.current) {
          smoothed = interpolatePosition(lastSnappedRef.current, snapped, 0.3, routeCoordinates);
        }
        lastSnappedRef.current = smoothed;

        // Track max speed
        maxSpeedKmhRef.current = Math.max(maxSpeedKmhRef.current, speedKmh);

        // 3. Compute Progress
        const progress = computeProgress(
          smoothed,
          routeCoordinates,
          currentStart,
          timestamp,
          speedKmh,
          routeResult.totalDurationSeconds,
        );

        // 4. Check Arrival
        const isLastSegment = smoothed.segmentIndex === routeCoordinates.length - 2;
        const hasReachedEnd = isLastSegment && smoothed.fractionAlongSegment >= 0.98;

        if (hasReachedEnd) {
          setTimeout(() => {
            providerRef.current?.stop();
            providerRef.current = null;
            void releaseWakeLock();
            const finalStats = buildRideStats(progress, routeResult, maxSpeedKmhRef.current);
            setRideStats(finalStats);
            setState((prevStats) => ({
              ...prevStats,
              status: 'arrived',
            }));
          }, 0);
        }

        return {
          ...curr,
          snapped: smoothed,
          raw: coord,
          heading: gpsHeading ?? curr.heading ?? smoothed.bearing,
          progress,
          error: null,
        };
      });
    });

    provider.onError((err: GeolocationPositionError | Error) => {
      let errorMessage = 'Geolocation error occurred.';
      if ('code' in err) {
        switch (err.code) {
          case 1: // PERMISSION_DENIED
            errorMessage =
              'Location permission was denied. Please allow location access to navigate.';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = 'Location information is currently unavailable.';
            break;
          case 3: // TIMEOUT
            errorMessage = 'Location request timed out. Please check GPS signal.';
            break;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setState((curr) => ({
        ...curr,
        error: errorMessage,
        permissionStatus: 'code' in err && err.code === 1 ? 'denied' : curr.permissionStatus,
      }));
    });

    provider.start();
  };

  const stopNavigation = useCallback(() => {
    providerRef.current?.stop();
    providerRef.current = null;
    lastSnappedRef.current = null;
    maxSpeedKmhRef.current = 0;
    accumulatedTimeSecondsRef.current = 0;
    void releaseWakeLock();

    setState((prev) => ({
      status: 'idle',
      cameraMode: prev.cameraMode,
      snapped: null,
      raw: null,
      progress: null,
      routeCoordinates: [],
      startTimestamp: null,
      heading: null,
      error: null,
      permissionStatus: prev.permissionStatus,
    }));
  }, [releaseWakeLock]);

  const pauseNavigation = () => {
    if (state.status !== 'active') return;

    providerRef.current?.stop();
    accumulatedTimeSecondsRef.current = state.progress?.elapsedSeconds ?? 0;
    void releaseWakeLock();

    setState((prev) => ({
      ...prev,
      status: 'paused',
    }));
  };

  const resumeNavigation = () => {
    if (state.status !== 'paused' || !providerRef.current) return;

    const newStartTimestamp = Date.now() - accumulatedTimeSecondsRef.current * 1000;

    setState((prev) => ({
      ...prev,
      status: 'active',
      startTimestamp: newStartTimestamp,
      error: null,
    }));

    void acquireWakeLock();
    providerRef.current.start();
  };

  const toggleCameraMode = () => {
    setState((prev) => ({
      ...prev,
      cameraMode: prev.cameraMode === 'north-up' ? 'heading-up' : 'north-up',
    }));
  };

  const statusRef = useRef(state.status);
  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  // Stop navigation only when the route meaningfully changes
  const routeSignatureRef = useRef<string>('');
  useEffect(() => {
    const len = routeCoordinates.length;
    const firstCoord = routeCoordinates[0];
    const lastCoord = routeCoordinates[len - 1];
    const first = firstCoord ? `${firstCoord.lat},${firstCoord.lng}` : '';
    const last = len > 1 && lastCoord ? `${lastCoord.lat},${lastCoord.lng}` : '';
    const signature = `${len}:${first}:${last}`;

    if (signature === routeSignatureRef.current) return;
    routeSignatureRef.current = signature;

    if (statusRef.current !== 'idle') {
      setTimeout(() => {
        stopNavigation();
      }, 0);
    }
  }, [routeCoordinates, stopNavigation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      providerRef.current?.stop();
      void releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return {
    state,
    startNavigation,
    stopNavigation,
    pauseNavigation,
    resumeNavigation,
    toggleCameraMode,
    rideStats,
  };
}
