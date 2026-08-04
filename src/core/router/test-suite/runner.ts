import type { LocalOverrides } from '../../config';
import type { StreetGraph } from '../../graph/types';
import { DijkstraRouter } from '../router';
import { avoidBusyRoadsCost, avoidStoppingCost, standardCost } from '../strategies';
import type { CostFunction } from '../types';
import type { RoutingTestCase, RoutingTestResult } from './types';

const defaultOverrides: LocalOverrides = {
  nodeDelays: new Map(),
  nodeNotes: new Map(),
  nodeTurns: new Map(),
  bikeConfig: { id: 'normal' },
};

/**
 * Resolves routing strategy string key to corresponding CostFunction evaluator.
 */
export function getStrategyCostFunction(strategy?: string): CostFunction {
  switch (strategy) {
    case 'stop_avoidance':
      return avoidStoppingCost;
    case 'quiet_streets':
      return avoidBusyRoadsCost;
    case 'standard':
    default:
      return standardCost;
  }
}

/**
 * Evaluates a single routing test case scenario against a graph and validates assertions.
 */
export function runRoutingTest(testCase: RoutingTestCase, graph: StreetGraph): RoutingTestResult {
  const startTime = performance.now();
  const router = new DijkstraRouter();
  const costFn = getStrategyCostFunction(testCase.strategy);

  const mergedOverrides: LocalOverrides = {
    ...defaultOverrides,
    ...testCase.overrides,
    nodeDelays: testCase.overrides?.nodeDelays ?? defaultOverrides.nodeDelays,
    nodeNotes: testCase.overrides?.nodeNotes ?? defaultOverrides.nodeNotes,
    nodeTurns: testCase.overrides?.nodeTurns ?? defaultOverrides.nodeTurns,
  };

  const route = router.findRoute(
    graph,
    testCase.startCoord,
    testCase.endCoord,
    costFn,
    mergedOverrides,
  );
  const executionTimeMs = performance.now() - startTime;
  const failures: string[] = [];

  if (!route) {
    failures.push('Route calculation returned null.');
    return {
      testId: testCase.id,
      passed: false,
      failures,
      resolvedRoute: null,
      executionTimeMs,
    };
  }

  const { assertions } = testCase;

  if (assertions.avoidedNodeIds && assertions.avoidedNodeIds.length > 0) {
    const routeNodeSet = new Set(route.pathNodeIds);
    for (const avoidedId of assertions.avoidedNodeIds) {
      if (routeNodeSet.has(avoidedId)) {
        failures.push(`Route contains avoided node ID '${avoidedId}'.`);
      }
    }
  }

  if (assertions.requiredNodeIds && assertions.requiredNodeIds.length > 0) {
    const routeNodeSet = new Set(route.pathNodeIds);
    for (const requiredId of assertions.requiredNodeIds) {
      if (!routeNodeSet.has(requiredId)) {
        failures.push(`Route is missing required node ID '${requiredId}'.`);
      }
    }
  }

  if (assertions.expectedStreetNames && assertions.expectedStreetNames.length > 0) {
    const streetSet = new Set(route.streets);
    for (const street of assertions.expectedStreetNames) {
      if (!streetSet.has(street)) {
        failures.push(`Route is missing expected street '${street}'.`);
      }
    }
  }

  if (
    assertions.maxDurationSeconds !== undefined &&
    route.totalDurationSeconds > assertions.maxDurationSeconds
  ) {
    failures.push(
      `Route duration (${route.totalDurationSeconds.toFixed(1)}s) exceeds max limit (${assertions.maxDurationSeconds}s).`,
    );
  }

  if (
    assertions.maxDistanceMeters !== undefined &&
    route.totalDistanceMeters > assertions.maxDistanceMeters
  ) {
    failures.push(
      `Route distance (${route.totalDistanceMeters.toFixed(1)}m) exceeds max limit (${assertions.maxDistanceMeters}m).`,
    );
  }

  if (
    assertions.minDistanceMeters !== undefined &&
    route.totalDistanceMeters < assertions.minDistanceMeters
  ) {
    failures.push(
      `Route distance (${route.totalDistanceMeters.toFixed(1)}m) is below min limit (${assertions.minDistanceMeters}m).`,
    );
  }

  return {
    testId: testCase.id,
    passed: failures.length === 0,
    failures,
    resolvedRoute: route,
    executionTimeMs,
  };
}

/**
 * Runs a collection of routing test case scenarios sequentially and returns evaluation results.
 */
export function runTestSuite(cases: RoutingTestCase[], graph: StreetGraph): RoutingTestResult[] {
  return cases.map((testCase) => runRoutingTest(testCase, graph));
}
