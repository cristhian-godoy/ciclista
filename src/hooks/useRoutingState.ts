import { useCallback, useEffect, useState } from 'react';

import type { Coordinate } from '../core/common/types';
import type { GraphNode } from '../core/graph/types';

/**
 * Supported routing strategies.
 */
export type RoutingStrategy = 'standard' | 'avoid-stops' | 'quiet-streets';

/**
 * Parses a coordinate string in 'lat,lng' format into a Coordinate object.
 *
 * @param val - Comma-separated latitude and longitude string.
 * @returns Parsed Coordinate or null if invalid.
 */
export function parseCoordString(val: string | null): Coordinate | null {
  if (!val) return null;
  const parts = val.split(',').map((p) => parseFloat(p.trim()));
  const lat = parts[0];
  const lng = parts[1];
  if (
    parts.length === 2 &&
    lat !== undefined &&
    lng !== undefined &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return { lat, lng };
  }
  return null;
}

/**
 * Parses a semicolon-separated list of coordinates into an array of Coordinate objects.
 *
 * @param val - Semicolon-delimited coordinate string.
 * @returns Array of parsed Coordinates.
 */
export function parseWaypointsString(val: string | null): Coordinate[] {
  if (!val) return [];
  const items = val.split(';');
  const result: Coordinate[] = [];
  for (const item of items) {
    const c = parseCoordString(item.trim());
    if (c) result.push(c);
  }
  return result;
}

/**
 * Formats a coordinate into a URL-friendly 'lat,lng' string.
 *
 * @param coord - Coordinate to serialize.
 * @returns Serialized coordinate string.
 */
export function formatCoordQuery(coord: Coordinate | null): string {
  if (!coord) return '';
  return `${coord.lat.toFixed(5)},${coord.lng.toFixed(5)}`;
}

/**
 * Formats an array of coordinates into a semicolon-separated string.
 *
 * @param waypoints - Array of coordinates to serialize.
 * @returns Serialized waypoints string.
 */
export function formatWaypointsQuery(waypoints: Coordinate[]): string {
  if (waypoints.length === 0) return '';
  return waypoints.map((w) => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`).join(';');
}

/**
 * Extracts initial routing state from current window.location query parameters.
 */
export function getInitialRoutingState() {
  if (typeof window === 'undefined') {
    return {
      startCoord: null,
      endCoord: null,
      waypoints: [] as Coordinate[],
      strategy: 'standard' as RoutingStrategy,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const start = parseCoordString(params.get('start'));
  const end = parseCoordString(params.get('end'));
  const rawStrategy = params.get('strategy');
  const strategy: RoutingStrategy =
    rawStrategy === 'avoid-stops' || rawStrategy === 'quiet-streets' || rawStrategy === 'standard'
      ? rawStrategy
      : 'standard';
  const waypoints = parseWaypointsString(params.get('waypoints'));

  return { startCoord: start, endCoord: end, waypoints, strategy };
}

/**
 * Hook to manage routing configuration state, coordinates, intermediate waypoints,
 * selected nodes, routing strategy, and URL parameter synchronization.
 */
export function useRoutingState() {
  const [startCoord, setStartCoord] = useState<Coordinate | null>(
    () => getInitialRoutingState().startCoord,
  );
  const [endCoord, setEndCoord] = useState<Coordinate | null>(
    () => getInitialRoutingState().endCoord,
  );
  const [waypoints, setWaypoints] = useState<Coordinate[]>(
    () => getInitialRoutingState().waypoints,
  );
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>(
    () => getInitialRoutingState().strategy,
  );

  const addWaypoint = useCallback((coord: Coordinate = { lat: 0, lng: 0 }) => {
    setWaypoints((prev) => [...prev, coord]);
  }, []);

  const removeWaypoint = useCallback((index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateWaypoint = useCallback((index: number, coord: Coordinate) => {
    setWaypoints((prev) => prev.map((w, i) => (i === index ? coord : w)));
  }, []);

  // Synchronize route state to URL search parameters without triggering infinite update loops
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentSearch = window.location.search;
    const currentParams = new URLSearchParams(currentSearch);
    const nextParams = new URLSearchParams(currentSearch);

    if (startCoord) {
      nextParams.set('start', formatCoordQuery(startCoord));
    } else {
      nextParams.delete('start');
    }

    if (endCoord) {
      nextParams.set('end', formatCoordQuery(endCoord));
    } else {
      nextParams.delete('end');
    }

    if (routingStrategy && routingStrategy !== 'standard') {
      nextParams.set('strategy', routingStrategy);
    } else if (routingStrategy === 'standard' && currentParams.has('strategy')) {
      nextParams.delete('strategy');
    }

    if (waypoints.length > 0) {
      nextParams.set('waypoints', formatWaypointsQuery(waypoints));
    } else {
      nextParams.delete('waypoints');
    }

    const currentQuery = currentParams.toString();
    const nextQuery = nextParams.toString();

    if (currentQuery !== nextQuery) {
      const newUrl = nextQuery
        ? `${window.location.pathname}?${nextQuery}`
        : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }, [startCoord, endCoord, routingStrategy, waypoints]);

  // Synchronize from URL on popstate navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const initial = getInitialRoutingState();
      setStartCoord(initial.startCoord);
      setEndCoord(initial.endCoord);
      setRoutingStrategy(initial.strategy);
      setWaypoints(initial.waypoints);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return {
    startCoord,
    setStartCoord,
    endCoord,
    setEndCoord,
    waypoints,
    setWaypoints,
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    selectedNode,
    setSelectedNode,
    routingStrategy,
    setRoutingStrategy,
  };
}

/**
 * Return type of the useRoutingState hook.
 */
export type UseRoutingStateReturn = ReturnType<typeof useRoutingState>;
