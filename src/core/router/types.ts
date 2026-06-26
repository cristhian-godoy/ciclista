import type { Coordinate } from '../common/types';
import type { LocalOverrides } from '../config';
import type { GraphEdge, StreetGraph } from '../graph/types';

/**
 * A function that calculates the routing cost/weight for traveling along a graph edge.
 */
export type CostFunction = (
  sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph,
) => number;

/**
 * Calculated routing path metrics including node IDs, coordinates, duration, distance, and node control statistics.
 */
export interface RouteResult {
  pathNodeIds: string[];
  coordinates: Coordinate[];
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  streets: string[];
  trafficSignalsCount: number;
  yieldCount: number;
  signalCount: number;
  crossingCount: number;
  roadTypeTotals: Record<string, number>;
  surfaceTotals: Record<'paved' | 'gravel' | 'cobblestone', number>;
  edges?: {
    sourceId: string;
    targetId: string;
    name: string;
    distance: number;
    highway: string;
    tags: Record<string, string>;
    cost: number;
    matchedSign: string | null;
    matchedRoad: string;
  }[];
}

/**
 * An alternative routing path option with a label (strategy name) and the routing result metrics.
 */
export interface StrategyRouteVariant {
  label: string;
  result: RouteResult;
}

/**
 * Router interface defining the findRoute method to compute optimal paths.
 */
export interface IRouter {
  findRoute(
    graph: StreetGraph,
    start: Coordinate,
    end: Coordinate,
    costFn: CostFunction,
    overrides: LocalOverrides,
  ): RouteResult | null;
}
