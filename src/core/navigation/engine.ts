import { getProjectionT, projectPointOnSegment } from '../common/geometry';
import type { Coordinate } from '../common/types';
import { haversineDistance } from '../graph/parser';
import type { RouteResult } from '../router/types';
import type { NavigationProgress, RideStats, SnappedPosition } from './types';

/**
 * Calculates the initial bearing from point A to point B on a sphere in degrees [0, 360).
 */
export function calculateBearing(a: Coordinate, b: Coordinate): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Snaps a raw coordinate to the closest point on the route polyline.
 * Uses forward search window optimization if a last segment index hint is provided.
 */
export function snapToRoute(
  raw: Coordinate,
  routeCoords: Coordinate[],
  hint?: { lastSegmentIndex: number },
): SnappedPosition {
  if (routeCoords.length === 0) {
    return {
      coordinate: raw,
      bearing: 0,
      segmentIndex: 0,
      fractionAlongSegment: 0,
      distanceFromRawM: 0,
    };
  }
  if (routeCoords.length === 1) {
    return {
      coordinate: routeCoords[0],
      bearing: 0,
      segmentIndex: 0,
      fractionAlongSegment: 0,
      distanceFromRawM: haversineDistance(raw.lat, raw.lng, routeCoords[0].lat, routeCoords[0].lng),
    };
  }

  let bestSegmentIndex = 0;
  let minDist = Infinity;
  let bestProjected: Coordinate = routeCoords[0];
  let bestT = 0;

  const numSegments = routeCoords.length - 1;

  // 1. Try forward search optimization within a window of 10 segments
  if (hint && typeof hint.lastSegmentIndex === 'number') {
    const startIndex = Math.max(0, Math.min(hint.lastSegmentIndex, numSegments - 1));
    const endIndex = Math.min(startIndex + 10, numSegments - 1);
    for (let i = startIndex; i <= endIndex; i++) {
      const a = routeCoords[i];
      const b = routeCoords[i + 1];
      const proj = projectPointOnSegment(raw, a, b);
      const dist = haversineDistance(raw.lat, raw.lng, proj.lat, proj.lng);
      if (dist < minDist) {
        minDist = dist;
        bestSegmentIndex = i;
        bestProjected = proj;
        bestT = getProjectionT(raw, a, b);
      }
    }
  }

  // 2. Fall back to scanning the entire route if no hint is provided or if closest window match exceeds 30 meters
  if (!hint || minDist > 30) {
    minDist = Infinity;
    for (let i = 0; i < numSegments; i++) {
      const a = routeCoords[i];
      const b = routeCoords[i + 1];
      const proj = projectPointOnSegment(raw, a, b);
      const dist = haversineDistance(raw.lat, raw.lng, proj.lat, proj.lng);
      if (dist < minDist) {
        minDist = dist;
        bestSegmentIndex = i;
        bestProjected = proj;
        bestT = getProjectionT(raw, a, b);
      }
    }
  }

  const bearing = calculateBearing(
    routeCoords[bestSegmentIndex],
    routeCoords[bestSegmentIndex + 1],
  );

  return {
    coordinate: bestProjected,
    bearing,
    segmentIndex: bestSegmentIndex,
    fractionAlongSegment: bestT,
    distanceFromRawM: minDist,
  };
}

/**
 * Dampens position jitter by interpolating along the route polyline.
 * Clamps backward jumps to prevent rewinding of the navigation marker.
 */
export function interpolatePosition(
  previous: SnappedPosition,
  current: SnappedPosition,
  alpha: number,
  routeCoords: Coordinate[],
): SnappedPosition {
  if (routeCoords.length < 2) {
    return current;
  }

  const pVal = previous.segmentIndex + previous.fractionAlongSegment;
  const cVal = current.segmentIndex + current.fractionAlongSegment;

  // Prevent rewinding
  if (cVal < pVal) {
    return previous;
  }

  const newVal = pVal + alpha * (cVal - pVal);
  let newSegmentIndex = Math.floor(newVal);
  let newFraction = newVal - newSegmentIndex;

  const numSegments = routeCoords.length - 1;
  if (newSegmentIndex >= numSegments) {
    newSegmentIndex = numSegments - 1;
    newFraction = 1.0;
  }
  if (newSegmentIndex < 0) {
    newSegmentIndex = 0;
    newFraction = 0.0;
  }

  const a = routeCoords[newSegmentIndex];
  const b = routeCoords[newSegmentIndex + 1];
  const interpolatedCoord = {
    lat: a.lat + newFraction * (b.lat - a.lat),
    lng: a.lng + newFraction * (b.lng - a.lng),
  };

  const bearing = calculateBearing(a, b);
  const distanceFromRawM =
    previous.distanceFromRawM + alpha * (current.distanceFromRawM - previous.distanceFromRawM);

  return {
    coordinate: interpolatedCoord,
    bearing,
    segmentIndex: newSegmentIndex,
    fractionAlongSegment: newFraction,
    distanceFromRawM,
  };
}

/**
 * Calculates current journey metrics based on snapped route position and elapsed time.
 */
export function computeProgress(
  snapped: SnappedPosition,
  routeCoords: Coordinate[],
  startTimestamp: number,
  currentTimestamp: number,
  currentSpeedKmh = 0,
  totalDurationSeconds?: number,
): NavigationProgress {
  if (routeCoords.length === 0) {
    return {
      distanceCoveredM: 0,
      distanceRemainingM: 0,
      etaSeconds: 0,
      elapsedSeconds: 0,
      averageSpeedKmh: 0,
      currentSpeedKmh: 0,
    };
  }

  let totalDistanceM = 0;
  let distanceCoveredM = 0;

  const numSegments = routeCoords.length - 1;
  for (let i = 0; i < numSegments; i++) {
    const segDist = haversineDistance(
      routeCoords[i].lat,
      routeCoords[i].lng,
      routeCoords[i + 1].lat,
      routeCoords[i + 1].lng,
    );
    totalDistanceM += segDist;

    if (i < snapped.segmentIndex) {
      distanceCoveredM += segDist;
    } else if (i === snapped.segmentIndex) {
      distanceCoveredM += snapped.fractionAlongSegment * segDist;
    }
  }

  const distanceRemainingM = Math.max(0, totalDistanceM - distanceCoveredM);
  const elapsedSeconds = Math.max(0, (currentTimestamp - startTimestamp) / 1000);

  // Compute average speed in km/h
  let averageSpeedKmh = 0;
  if (elapsedSeconds > 0) {
    averageSpeedKmh = (distanceCoveredM / elapsedSeconds) * 3.6;
  }

  // Compute ETA
  let etaSeconds = 0;
  if (distanceRemainingM > 0) {
    if (averageSpeedKmh > 2) {
      etaSeconds = distanceRemainingM / (averageSpeedKmh / 3.6);
    } else if (typeof totalDurationSeconds === 'number' && totalDistanceM > 0) {
      // Fallback: estimate proportional remaining duration
      const fractionRemaining = distanceRemainingM / totalDistanceM;
      etaSeconds = fractionRemaining * totalDurationSeconds;
    } else {
      // General fallback using a standard 15 km/h cycling speed
      etaSeconds = distanceRemainingM / (15 / 3.6);
    }
  }

  return {
    distanceCoveredM,
    distanceRemainingM,
    etaSeconds,
    elapsedSeconds,
    averageSpeedKmh,
    currentSpeedKmh,
  };
}

/**
 * Assembles a summary stats block for display at destination arrival.
 */
export function buildRideStats(
  progress: NavigationProgress,
  route: RouteResult,
  maxSpeedKmh: number,
  routeProfile = 'custom',
): RideStats {
  return {
    totalDistanceM: progress.distanceCoveredM,
    totalTimeSeconds: progress.elapsedSeconds,
    averageSpeedKmh: progress.averageSpeedKmh,
    maxSpeedKmh,
    trafficLightsEncountered: route.trafficSignalsCount || 0,
    routeProfile,
  };
}
