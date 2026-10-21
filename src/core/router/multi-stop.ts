import type { Coordinate } from '../common/types';
import type { LocalOverrides } from '../config';
import type { StreetGraph } from '../graph/types';
import type { CostFunction, IRouter, RouteResult } from './types';

/**
 * Merges multiple sequential RouteResult segments into a unified RouteResult.
 *
 * @param segments - Sequential array of calculated route segments.
 * @returns Combined end-to-end route result.
 */
export function combineRouteResults(segments: RouteResult[]): RouteResult {
  if (segments.length === 0) {
    throw new Error('Cannot combine empty segments');
  }
  if (segments.length === 1) {
    return segments[0];
  }

  const pathNodeIds: string[] = [];
  const coordinates: Coordinate[] = [];
  let totalDurationSeconds = 0;
  let totalDistanceMeters = 0;
  const streetSet = new Set<string>();
  let trafficSignalsCount = 0;
  let yieldCount = 0;
  let signalCount = 0;
  let crossingCount = 0;
  const roadTypeTotals: Record<string, number> = {};
  const surfaceTotals: Record<'paved' | 'gravel' | 'cobblestone', number> = {
    paved: 0,
    gravel: 0,
    cobblestone: 0,
  };
  const edges: NonNullable<RouteResult['edges']> = [];

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    totalDurationSeconds += seg.totalDurationSeconds;
    totalDistanceMeters += seg.totalDistanceMeters;
    trafficSignalsCount += seg.trafficSignalsCount;
    yieldCount += seg.yieldCount;
    signalCount += seg.signalCount;
    crossingCount += seg.crossingCount;

    for (const street of seg.streets) {
      if (street) streetSet.add(street);
    }

    for (const [rt, dist] of Object.entries(seg.roadTypeTotals)) {
      roadTypeTotals[rt] = (roadTypeTotals[rt] ?? 0) + dist;
    }

    surfaceTotals.paved += seg.surfaceTotals.paved;
    surfaceTotals.gravel += seg.surfaceTotals.gravel;
    surfaceTotals.cobblestone += seg.surfaceTotals.cobblestone;

    if (seg.edges) {
      edges.push(...seg.edges);
    }

    // Coordinates: avoid duplicating connecting waypoint
    const startIdx = s === 0 ? 0 : 1;
    for (let c = startIdx; c < seg.coordinates.length; c++) {
      coordinates.push(seg.coordinates[c]);
    }

    // PathNodeIds: avoid duplicating connecting node
    const nodeStartIdx = s === 0 ? 0 : 1;
    for (let n = nodeStartIdx; n < seg.pathNodeIds.length; n++) {
      pathNodeIds.push(seg.pathNodeIds[n]);
    }
  }

  return {
    pathNodeIds,
    coordinates,
    totalDurationSeconds,
    totalDistanceMeters,
    streets: Array.from(streetSet),
    trafficSignalsCount,
    yieldCount,
    signalCount,
    crossingCount,
    roadTypeTotals,
    surfaceTotals,
    edges: edges.length > 0 ? edges : undefined,
  };
}

/**
 * Computes an end-to-end multi-stop route by chaining pathfinding segments
 * across intermediate waypoints: [start, ...waypoints, end].
 *
 * @param router - Base router engine executing segment calculations.
 * @param graph - Parsed street graph.
 * @param points - Sequence of route coordinates including start, intermediate waypoints, and destination.
 * @param costFn - Weight cost calculation function.
 * @param overrides - User overrides and bike configuration.
 * @returns Unified RouteResult or null if any segment is unreachable.
 */
export function findMultiStopRoute(
  router: IRouter,
  graph: StreetGraph,
  points: Coordinate[],
  costFn: CostFunction,
  overrides: LocalOverrides,
): RouteResult | null {
  if (points.length < 2) {
    return null;
  }
  if (points.length === 2) {
    return router.findRoute(graph, points[0], points[1], costFn, overrides);
  }

  const segments: RouteResult[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const segmentResult = router.findRoute(graph, from, to, costFn, overrides);
    if (!segmentResult) {
      return null;
    }
    segments.push(segmentResult);
  }

  return combineRouteResults(segments);
}
