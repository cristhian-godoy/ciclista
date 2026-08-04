import type { RoutingTestCase } from './types';

/**
 * Central registry of routing test cases.
 * Initialized with 1 baseline sample test case on Munich preset graph.
 */
export const ROUTING_TEST_CASES: RoutingTestCase[] = [
  {
    id: 'munich-baseline-marienplatz-isartor',
    name: 'Marienplatz to Isartor Standard Route',
    description:
      'Validates optimal path calculation and non-zero distance/duration between Marienplatz and Isartor.',
    preset: 'munich',
    startCoord: { lat: 48.13715, lng: 11.5754 },
    endCoord: { lat: 48.135, lng: 11.582 },
    strategy: 'standard',
    assertions: {
      minDistanceMeters: 100,
      maxDistanceMeters: 5000,
      maxDurationSeconds: 1200,
    },
  },
];
