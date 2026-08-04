import type { Coordinate } from '../../common/types';
import type { LocalOverrides } from '../../config';
import type { RouteResult } from '../types';

/**
 * Expected route path constraints and metric assertions.
 */
export interface RoutingAssertion {
  avoidedNodeIds?: string[];
  requiredNodeIds?: string[];
  expectedStreetNames?: string[];
  maxDurationSeconds?: number;
  maxDistanceMeters?: number;
  minDistanceMeters?: number;
}

/**
 * Complete test case scenario configuration for routing path evaluation.
 */
export interface RoutingTestCase {
  id: string;
  name: string;
  description: string;
  preset: 'munich' | 'amsterdam';
  startCoord: Coordinate;
  endCoord: Coordinate;
  strategy?: 'standard' | 'stop_avoidance' | 'quiet_streets';
  overrides?: Partial<LocalOverrides>;
  assertions: RoutingAssertion;
}

/**
 * Execution evaluation metrics and result status of a routing test scenario.
 */
export interface RoutingTestResult {
  testId: string;
  passed: boolean;
  failures: string[];
  resolvedRoute: RouteResult | null;
  executionTimeMs: number;
}
