import { describe, expect, it } from 'vitest';

import type { Coordinate } from '../common/types';
import type { StreetGraph } from '../graph/types';
import { combineRouteResults, findMultiStopRoute } from './multi-stop';
import type { IRouter, RouteResult } from './types';

function createMockSegment(
  nodeIds: string[],
  coords: Coordinate[],
  duration: number,
  distance: number,
  street: string,
): RouteResult {
  return {
    pathNodeIds: nodeIds,
    coordinates: coords,
    totalDurationSeconds: duration,
    totalDistanceMeters: distance,
    streets: [street],
    trafficSignalsCount: 1,
    yieldCount: 0,
    signalCount: 1,
    crossingCount: 1,
    roadTypeTotals: { cycleway: distance },
    surfaceTotals: { paved: distance, gravel: 0, cobblestone: 0 },
  };
}

describe('multi-stop routing engine', () => {
  describe('combineRouteResults', () => {
    it('throws error when given empty segments', () => {
      expect(() => combineRouteResults([])).toThrow('Cannot combine empty segments');
    });

    it('returns the single segment if only one is provided', () => {
      const seg = createMockSegment(
        ['n1', 'n2'],
        [
          { lat: 10, lng: 10 },
          { lat: 11, lng: 11 },
        ],
        60,
        1000,
        'Main St',
      );
      expect(combineRouteResults([seg])).toBe(seg);
    });

    it('chains multiple segments and aggregates metrics without duplicating boundary points', () => {
      const seg1 = createMockSegment(
        ['n1', 'n2'],
        [
          { lat: 10, lng: 10 },
          { lat: 11, lng: 11 },
        ],
        60,
        1000,
        'Street A',
      );
      const seg2 = createMockSegment(
        ['n2', 'n3'],
        [
          { lat: 11, lng: 11 },
          { lat: 12, lng: 12 },
        ],
        90,
        1500,
        'Street B',
      );

      const combined = combineRouteResults([seg1, seg2]);
      expect(combined.pathNodeIds).toEqual(['n1', 'n2', 'n3']);
      expect(combined.coordinates).toEqual([
        { lat: 10, lng: 10 },
        { lat: 11, lng: 11 },
        { lat: 12, lng: 12 },
      ]);
      expect(combined.totalDurationSeconds).toBe(150);
      expect(combined.totalDistanceMeters).toBe(2500);
      expect(combined.streets).toContain('Street A');
      expect(combined.streets).toContain('Street B');
      expect(combined.trafficSignalsCount).toBe(2);
      expect(combined.surfaceTotals.paved).toBe(2500);
      expect(combined.roadTypeTotals.cycleway).toBe(2500);
    });
  });

  describe('findMultiStopRoute', () => {
    const mockGraph: StreetGraph = {
      nodes: new Map(),
    };

    it('returns null when less than 2 coordinates are provided', () => {
      const mockRouter: IRouter = { findRoute: () => null };
      expect(
        findMultiStopRoute(mockRouter, mockGraph, [{ lat: 0, lng: 0 }], () => 1, {
          nodeDelays: new Map(),
          nodeNotes: new Map(),
          nodeTurns: new Map(),
        }),
      ).toBeNull();
    });

    it('delegates to router.findRoute directly when 2 coordinates are provided', () => {
      const seg = createMockSegment(
        ['n1', 'n2'],
        [
          { lat: 0, lng: 0 },
          { lat: 1, lng: 1 },
        ],
        10,
        100,
        'St',
      );
      const mockRouter: IRouter = {
        findRoute: () => seg,
      };

      const result = findMultiStopRoute(
        mockRouter,
        mockGraph,
        [
          { lat: 0, lng: 0 },
          { lat: 1, lng: 1 },
        ],
        () => 1,
        {
          nodeDelays: new Map(),
          nodeNotes: new Map(),
          nodeTurns: new Map(),
        },
      );
      expect(result).toBe(seg);
    });

    it('chains segments across 3 points (1 intermediate waypoint) successfully', () => {
      const seg1 = createMockSegment(
        ['n1', 'n2'],
        [
          { lat: 0, lng: 0 },
          { lat: 1, lng: 1 },
        ],
        10,
        100,
        'St1',
      );
      const seg2 = createMockSegment(
        ['n2', 'n3'],
        [
          { lat: 1, lng: 1 },
          { lat: 2, lng: 2 },
        ],
        20,
        200,
        'St2',
      );

      const segments = [seg1, seg2];
      let callCount = 0;
      const mockRouter: IRouter = {
        findRoute: () => segments[callCount++] ?? null,
      };

      const result = findMultiStopRoute(
        mockRouter,
        mockGraph,
        [
          { lat: 0, lng: 0 },
          { lat: 1, lng: 1 },
          { lat: 2, lng: 2 },
        ],
        () => 1,
        {
          nodeDelays: new Map(),
          nodeNotes: new Map(),
          nodeTurns: new Map(),
        },
      );

      expect(result).not.toBeNull();
      expect(result?.coordinates).toHaveLength(3);
      expect(result?.totalDistanceMeters).toBe(300);
      expect(result?.totalDurationSeconds).toBe(30);
    });

    it('returns null if any segment in the chain cannot be reached', () => {
      let callCount = 0;
      const mockRouter: IRouter = {
        findRoute: () => {
          callCount++;
          if (callCount === 1) {
            return createMockSegment(
              ['n1', 'n2'],
              [
                { lat: 0, lng: 0 },
                { lat: 1, lng: 1 },
              ],
              10,
              100,
              'St1',
            );
          }
          return null;
        },
      };

      const result = findMultiStopRoute(
        mockRouter,
        mockGraph,
        [
          { lat: 0, lng: 0 },
          { lat: 1, lng: 1 },
          { lat: 2, lng: 2 },
        ],
        () => 1,
        {
          nodeDelays: new Map(),
          nodeNotes: new Map(),
          nodeTurns: new Map(),
        },
      );

      expect(result).toBeNull();
    });
  });
});
