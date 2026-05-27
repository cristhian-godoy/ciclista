import { useEffect, useRef, useState } from 'react';

import type { Coordinate } from '../core/common/types';
import {
  buildRideStats,
  calculateBearing,
  computeProgress,
  interpolatePosition,
  snapToRoute,
} from '../core/navigation/engine';
import { createPositionProvider } from '../core/navigation/position';
import type { NavigationProgress, NavigationState, RideStats } from '../core/navigation/types';
import type { RouteResult } from '../core/router/types';

interface UseNavigationProps {
  routeResult: RouteResult | null;
  routeCoordinates: Coordinate[];
}

/**
 * Custom hook orchestrating turn-by-turn navigation state, positioning provider and smoothing updates.
 */
export function useNavigation({ routeResult, routeCoordinates }: UseNavigationProps) {
  const [state, setState] = useState<NavigationState>({
    status: 'idle',
    cameraMode: 'heading-up',
    snapped: null,
    raw: null,
    progress: null,
    routeCoordinates: [],
    startTimestamp: null,
  });

  const [rideStats, setRideStats] = useState<RideStats | null>(null);

  const providerRef = useRef<ReturnType<typeof createPositionProvider> | null>(null);
  const lastSnappedRef = useRef<ReturnType<typeof snapToRoute> | null>(null);
  const maxSpeedKmhRef = useRef<number>(0);
  const accumulatedTimeSecondsRef = useRef<number>(0);

  const startNavigation = () => {
    if (routeCoordinates.length === 0 || !routeResult) return;

    // Cleanup previous if any
    providerRef.current?.stop();

    const mode = import.meta.env.DEV ? 'dev' : 'gps';
    const initialCoord = routeCoordinates[0];
    const provider = createPositionProvider(mode, initialCoord);
    providerRef.current = provider;

    maxSpeedKmhRef.current = 0;
    lastSnappedRef.current = null;
    accumulatedTimeSecondsRef.current = 0;
    setRideStats(null);

    const startTimestamp = Date.now();

    const initialSnapped = {
      coordinate: initialCoord,
      bearing:
        routeCoordinates.length > 1
          ? calculateBearing(routeCoordinates[0], routeCoordinates[1])
          : 0,
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
    }));

    provider.onPosition((coord, timestamp, speedKmh = 0) => {
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
          // Defer stop call to prevent state updates during render
          setTimeout(() => {
            providerRef.current?.stop();
            providerRef.current = null;
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
          progress,
        };
      });
    });

    provider.onError((err) => {
      console.error('Navigation position error:', err);
    });

    provider.start();
  };

  const stopNavigation = () => {
    providerRef.current?.stop();
    providerRef.current = null;
    lastSnappedRef.current = null;
    maxSpeedKmhRef.current = 0;
    accumulatedTimeSecondsRef.current = 0;

    setState((prev) => ({
      status: 'idle',
      cameraMode: prev.cameraMode,
      snapped: null,
      raw: null,
      progress: null,
      routeCoordinates: [],
      startTimestamp: null,
    }));
  };

  const pauseNavigation = () => {
    if (state.status !== 'active') return;

    providerRef.current?.stop();
    accumulatedTimeSecondsRef.current = state.progress?.elapsedSeconds ?? 0;

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
    }));

    providerRef.current.start();
  };

  const toggleCameraMode = () => {
    setState((prev) => ({
      ...prev,
      cameraMode: prev.cameraMode === 'north-up' ? 'heading-up' : 'north-up',
    }));
  };

  // Stop provider when route coordinates or result changes
  useEffect(() => {
    if (state.status !== 'idle') {
      setTimeout(() => {
        stopNavigation();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCoordinates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      providerRef.current?.stop();
    };
  }, []);

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
