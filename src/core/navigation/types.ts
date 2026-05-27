import type { Coordinate } from '../common/types';

/**
 * Valid states of the navigation tracking cycle.
 */
export type NavigationStatus = 'idle' | 'active' | 'paused' | 'arrived';

/**
 * Camera orientation modes relative to the user position and trajectory.
 */
export type CameraMode = 'north-up' | 'heading-up';

/**
 * Struct containing coordinates projected onto a route segment and related metrics.
 */
export interface SnappedPosition {
  coordinate: Coordinate;
  bearing: number;
  segmentIndex: number;
  fractionAlongSegment: number;
  distanceFromRawM: number;
}

/**
 * Metric tracking of distance and speed calculations.
 */
export interface NavigationProgress {
  distanceCoveredM: number;
  distanceRemainingM: number;
  etaSeconds: number;
  elapsedSeconds: number;
  averageSpeedKmh: number;
  currentSpeedKmh: number;
}

/**
 * Execution state of the navigation manager.
 */
export interface NavigationState {
  status: NavigationStatus;
  cameraMode: CameraMode;
  snapped: SnappedPosition | null;
  progress: NavigationProgress | null;
  routeCoordinates: Coordinate[];
  startTimestamp: number | null;
}

/**
 * Session statistics calculated at the end of the trajectory.
 */
export interface RideStats {
  totalDistanceM: number;
  totalTimeSeconds: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  trafficLightsEncountered: number;
  routeProfile: string;
}

/**
 * Data structure reserving the API surface for future rerouting calculations.
 */
export interface DetourRequest {
  currentPosition: Coordinate;
  remainingRoute: Coordinate[];
  reason: 'off_route' | 'user_requested';
}
