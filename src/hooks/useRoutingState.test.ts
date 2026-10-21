import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  formatCoordQuery,
  formatWaypointsQuery,
  parseCoordString,
  parseWaypointsString,
  useRoutingState,
} from './useRoutingState';

describe('useRoutingState & URL parameter synchronization', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  describe('coordinate & query parsers', () => {
    it('parses valid comma-separated lat,lng string', () => {
      expect(parseCoordString('48.137, 11.575')).toEqual({ lat: 48.137, lng: 11.575 });
      expect(parseCoordString('48.137,11.575')).toEqual({ lat: 48.137, lng: 11.575 });
    });

    it('returns null on invalid or out-of-bounds coordinates', () => {
      expect(parseCoordString(null)).toBeNull();
      expect(parseCoordString('')).toBeNull();
      expect(parseCoordString('abc,def')).toBeNull();
      expect(parseCoordString('100,200')).toBeNull(); // out of bounds
    });

    it('parses and formats multiple waypoints string', () => {
      const waypoints = [
        { lat: 48.1, lng: 11.1 },
        { lat: 48.2, lng: 11.2 },
      ];
      const query = formatWaypointsQuery(waypoints);
      expect(query).toBe('48.10000,11.10000;48.20000,11.20000');
      const parsed = parseWaypointsString(query);
      expect(parsed).toEqual([
        { lat: 48.1, lng: 11.1 },
        { lat: 48.2, lng: 11.2 },
      ]);
    });

    it('formats single coordinate query', () => {
      expect(formatCoordQuery(null)).toBe('');
      expect(formatCoordQuery({ lat: 48.137, lng: 11.575 })).toBe('48.13700,11.57500');
    });
  });

  describe('useRoutingState hook', () => {
    it('initializes with null coordinates and standard strategy when URL is clean', () => {
      const { result } = renderHook(() => useRoutingState());
      expect(result.current.startCoord).toBeNull();
      expect(result.current.endCoord).toBeNull();
      expect(result.current.waypoints).toEqual([]);
      expect(result.current.routingStrategy).toBe('standard');
    });

    it('restores start, end, strategy, and waypoints from URL search parameters on mount', () => {
      window.history.replaceState(
        null,
        '',
        '/?start=48.13700,11.57500&end=48.14000,11.58000&strategy=quiet-streets&waypoints=48.13800,11.57700',
      );

      const { result } = renderHook(() => useRoutingState());
      expect(result.current.startCoord).toEqual({ lat: 48.137, lng: 11.575 });
      expect(result.current.endCoord).toEqual({ lat: 48.14, lng: 11.58 });
      expect(result.current.routingStrategy).toBe('quiet-streets');
      expect(result.current.waypoints).toEqual([{ lat: 48.138, lng: 11.577 }]);
    });

    it('updates URL search parameters when coordinates or strategy change', () => {
      const { result } = renderHook(() => useRoutingState());

      act(() => {
        result.current.setStartCoord({ lat: 48.137, lng: 11.575 });
        result.current.setEndCoord({ lat: 48.14, lng: 11.58 });
        result.current.setRoutingStrategy('avoid-stops');
      });

      const params = new URLSearchParams(window.location.search);
      expect(params.get('start')).toBe('48.13700,11.57500');
      expect(params.get('end')).toBe('48.14000,11.58000');
      expect(params.get('strategy')).toBe('avoid-stops');
    });

    it('supports adding, updating, and removing intermediate waypoints', () => {
      const { result } = renderHook(() => useRoutingState());

      act(() => {
        result.current.addWaypoint({ lat: 48.138, lng: 11.577 });
      });
      expect(result.current.waypoints).toEqual([{ lat: 48.138, lng: 11.577 }]);

      act(() => {
        result.current.updateWaypoint(0, { lat: 48.139, lng: 11.578 });
      });
      expect(result.current.waypoints).toEqual([{ lat: 48.139, lng: 11.578 }]);

      act(() => {
        result.current.removeWaypoint(0);
      });
      expect(result.current.waypoints).toEqual([]);
    });

    it('reacts to window popstate events', () => {
      const { result } = renderHook(() => useRoutingState());

      act(() => {
        window.history.replaceState(null, '', '/?start=48.15000,11.60000&end=48.16000,11.61000');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(result.current.startCoord).toEqual({ lat: 48.15, lng: 11.6 });
      expect(result.current.endCoord).toEqual({ lat: 48.16, lng: 11.61 });
    });
  });
});
