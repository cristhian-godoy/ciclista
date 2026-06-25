import type { Coordinate } from '../common/types';
import type { ComfortLevel, LocalOverrides } from '../config';
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
  alternativeEvaluations?: Record<string, AlternativeEdgeEvaluation[]>;
}

/**
 * An alternative routing path option with a label (strategy name) and the routing result metrics.
 */
export interface RouteAlternative {
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

/**
 * Detailed routing cost and physical impact evaluation for a single graph edge.
 */
export interface AlternativeEdgeEvaluation {
  targetId: string;
  name: string;
  distance: number;
  highway: string;
  baseSpeedKmh: number;
  effectiveSpeedKmh: number;
  surface: 'paved' | 'gravel' | 'cobblestone';
  flatPenaltySeconds: number;
  comfort: ComfortLevel;
  matchedSign: string | null;
  matchedRoad: string;
  routingWeight: number;
  displayCostSeconds: number;
  isRestricted: boolean;
  turnPenaltySeconds: number;
  nodeDelaySeconds: number;
  nodeDelayType: 'signal' | 'yield' | 'stop' | 'crossing' | 'custom' | null;
  restrictionReason: 'footway_not_bicycle_frei' | null;
  rulePenalties?: {
    name: string;
    value: number;
    type: 'turn' | 'node_delay' | 'surface' | 'road_class' | 'restriction' | 'service';
  }[];
  altPathNodeIds?: string[];
  altCoordinates?: Coordinate[];
  altDurationSeconds?: number;
  altDistanceMeters?: number;
  altSignalCount?: number;
  chosenRemainingDuration?: number;
  chosenRemainingDistance?: number;
  chosenRemainingSignals?: number;
}
