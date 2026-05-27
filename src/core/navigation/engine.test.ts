import { describe, expect, it } from 'vitest';

import type { Coordinate } from '../common/types';
import { RouteResult } from '../router/types';
import {
  buildRideStats,
  calculateBearing,
  computeProgress,
  interpolatePosition,
  snapToRoute,
} from './engine';
import { SnappedPosition } from './types';

describe('Navigation Engine', () => {
  const route: Coordinate[] = [
    { lat: 48.8584, lng: 2.2945 }, // Start (Paris/Eiffel)
    { lat: 48.8594, lng: 2.2945 }, // Segment 1 end (approx 111m north)
    { lat: 48.8594, lng: 2.296 }, // Segment 2 end (approx 110m east)
  ];

  describe('calculateBearing', () => {
    it('calculates north bearing correctly', () => {
      const a = { lat: 0, lng: 0 };
      const b = { lat: 1, lng: 0 };
      expect(calculateBearing(a, b)).toBeCloseTo(0, 1);
    });

    it('calculates east bearing correctly', () => {
      const a = { lat: 0, lng: 0 };
      const b = { lat: 0, lng: 1 };
      expect(calculateBearing(a, b)).toBeCloseTo(90, 1);
    });

    it('calculates south bearing correctly', () => {
      const a = { lat: 0, lng: 0 };
      const b = { lat: -1, lng: 0 };
      expect(calculateBearing(a, b)).toBeCloseTo(180, 1);
    });

    it('calculates west bearing correctly', () => {
      const a = { lat: 0, lng: 0 };
      const b = { lat: 0, lng: -1 };
      expect(calculateBearing(a, b)).toBeCloseTo(270, 1);
    });
  });

  describe('snapToRoute', () => {
    it('returns raw position if route is empty', () => {
      const raw = { lat: 48.8, lng: 2.2 };
      const res = snapToRoute(raw, []);
      expect(res.coordinate).toEqual(raw);
      expect(res.segmentIndex).toBe(0);
    });

    it('snaps to the single node if route only has 1 coordinate', () => {
      const raw = { lat: 48.8, lng: 2.2 };
      const single = [{ lat: 48.81, lng: 2.21 }];
      const res = snapToRoute(raw, single);
      expect(res.coordinate).toEqual(single[0]);
      expect(res.segmentIndex).toBe(0);
    });

    it('snaps along a straight segment', () => {
      const raw = { lat: 48.8589, lng: 2.2946 }; // Slightly east of segment 1 midpoint
      const res = snapToRoute(raw, route);
      expect(res.segmentIndex).toBe(0);
      expect(res.fractionAlongSegment).toBeCloseTo(0.5, 2);
      expect(res.coordinate.lng).toBeCloseTo(2.2945, 4);
    });

    it('snaps along an L-shaped path corner', () => {
      const raw = { lat: 48.8595, lng: 2.295 }; // Midpoint of segment 2
      const res = snapToRoute(raw, route);
      expect(res.segmentIndex).toBe(1);
      expect(res.fractionAlongSegment).toBeCloseTo(0.33, 1);
    });

    it('uses segment index hint to search forward and falls back if too far', () => {
      // With hint at 0, search segment 0. Raw coordinate is on segment 1.
      const raw = { lat: 48.8594, lng: 2.295 }; // Midpoint of segment 1 (index 1)
      // Since segment 1 is index 1, index 0 is within forward search window (+10 segments),
      // so it should scan both and correctly find index 1.
      let res = snapToRoute(raw, route, { lastSegmentIndex: 0 });
      expect(res.segmentIndex).toBe(1);

      // Now create a larger mock route to test window exclusion.
      const longRoute: Coordinate[] = Array.from({ length: 20 }, (_, i) => ({
        lat: 48.8584 + i * 0.001,
        lng: 2.2945,
      }));

      // Raw coordinate is far ahead on segment 15 (midpoint of segment 15 is at index 15, fraction 0.5)
      const rawFar = { lat: 48.8584 + 15.5 * 0.001, lng: 2.2945 };
      // Hint is 0. Window index 0 to 10. Segment 15 is index 15 (outside window).
      // If we query, the closest point in window [0..10] will be index 10 (which is > 30 meters away).
      // Since minDist in window is > 30 meters, snapToRoute falls back to full scan, matching segment 15.
      res = snapToRoute(rawFar, longRoute, { lastSegmentIndex: 0 });
      expect(res.segmentIndex).toBe(15);
    });
  });

  describe('interpolatePosition', () => {
    const prevSnap: SnappedPosition = {
      coordinate: { lat: 48.8584, lng: 2.2945 },
      bearing: 0,
      segmentIndex: 0,
      fractionAlongSegment: 0,
      distanceFromRawM: 0,
    };

    const currSnap: SnappedPosition = {
      coordinate: { lat: 48.8589, lng: 2.2945 },
      bearing: 0,
      segmentIndex: 0,
      fractionAlongSegment: 0.5,
      distanceFromRawM: 10,
    };

    it('returns previous position if alpha is 0', () => {
      const res = interpolatePosition(prevSnap, currSnap, 0, route);
      expect(res.fractionAlongSegment).toBe(0);
      expect(res.coordinate.lat).toBeCloseTo(prevSnap.coordinate.lat, 6);
      expect(res.coordinate.lng).toBeCloseTo(prevSnap.coordinate.lng, 6);
    });

    it('returns current position if alpha is 1', () => {
      const res = interpolatePosition(prevSnap, currSnap, 1, route);
      expect(res.fractionAlongSegment).toBe(0.5);
      expect(res.coordinate.lat).toBeCloseTo(currSnap.coordinate.lat, 6);
      expect(res.coordinate.lng).toBeCloseTo(currSnap.coordinate.lng, 6);
    });

    it('interpolates intermediate values correctly', () => {
      const res = interpolatePosition(prevSnap, currSnap, 0.4, route);
      expect(res.fractionAlongSegment).toBeCloseTo(0.2, 2);
      expect(res.distanceFromRawM).toBeCloseTo(4, 2);
    });

    it('clamps backward jumps (U-turn/rewinding suppression)', () => {
      // Current snap is behind previous
      const badCurrSnap: SnappedPosition = {
        coordinate: { lat: 48.858, lng: 2.2945 },
        bearing: 0,
        segmentIndex: 0,
        fractionAlongSegment: 0,
        distanceFromRawM: 1,
      };
      const advancedPrevSnap = { ...prevSnap, fractionAlongSegment: 0.3 };
      const res = interpolatePosition(advancedPrevSnap, badCurrSnap, 0.5, route);
      expect(res).toEqual(advancedPrevSnap);
    });
  });

  describe('computeProgress', () => {
    it('correctly tracks progress on a multi-segment route', () => {
      const snap: SnappedPosition = {
        coordinate: { lat: 48.8594, lng: 2.295 },
        bearing: 90,
        segmentIndex: 1,
        fractionAlongSegment: 0.33,
        distanceFromRawM: 2,
      };

      const start = 1716830000000;
      const current = start + 30000; // 30 seconds later

      const progress = computeProgress(snap, route, start, current, 12);
      expect(progress.elapsedSeconds).toBe(30);
      expect(progress.currentSpeedKmh).toBe(12);
      expect(progress.distanceCoveredM).toBeGreaterThan(111); // covered segment 0 + fraction of segment 1
      expect(progress.distanceRemainingM).toBeGreaterThan(0);
      expect(progress.averageSpeedKmh).toBeCloseTo((progress.distanceCoveredM / 30) * 3.6, 2);
    });
  });

  describe('buildRideStats', () => {
    it('correctly builds final stats', () => {
      const progress = {
        distanceCoveredM: 1200,
        distanceRemainingM: 0,
        etaSeconds: 0,
        elapsedSeconds: 300,
        averageSpeedKmh: 14.4,
        currentSpeedKmh: 0,
      };

      const mockRoute: RouteResult = {
        pathNodeIds: [],
        coordinates: [],
        totalDurationSeconds: 400,
        totalDistanceMeters: 1200,
        streets: [],
        trafficSignalsCount: 3,
        yieldCount: 0,
        signalCount: 0,
        crossingCount: 0,
        roadTypeTotals: {},
        surfaceTotals: { paved: 1200, gravel: 0, cobblestone: 0 },
      };

      const stats = buildRideStats(progress, mockRoute, 25.5, 'cycling');
      expect(stats.totalDistanceM).toBe(1200);
      expect(stats.totalTimeSeconds).toBe(300);
      expect(stats.averageSpeedKmh).toBe(14.4);
      expect(stats.maxSpeedKmh).toBe(25.5);
      expect(stats.trafficLightsEncountered).toBe(3);
      expect(stats.routeProfile).toBe('cycling');
    });
  });
});
