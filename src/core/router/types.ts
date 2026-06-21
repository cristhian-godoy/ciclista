import type { Coordinate } from '../common/types';
import type { GraphEdge, StreetGraph } from '../graph/types';
import type { LocalOverrides } from '../storage/types';

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

export const InfrastructureType = {
  PEDESTRIAN_ZONE: 'pedestrian_zone',
  SIDEWALK: 'sidewalk',
  SHARED_PATH: 'shared_path',
  SEGREGATED_PATH: 'segregated_path',
  LIVING_STREET: 'living_street',
  BICYCLE_STREET: 'bicycle_street',
} as const;
/**
 * Generic internal routing/infrastructure concepts mapped from OSM tags.
 */
export type InfrastructureType = (typeof InfrastructureType)[keyof typeof InfrastructureType];

export const RoadType = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  RESIDENTIAL: 'residential',
  SERVICE: 'service',
  PATH_DEFAULT: 'path_default',
} as const;
/**
 * Classifications for various OSM highway types.
 */
export type RoadType = (typeof RoadType)[keyof typeof RoadType];

/**
 * Defines the user-configured cycling comfort ratings.
 */
export type ComfortLevel = 'very_low' | 'low' | 'neutral' | 'high' | 'very_high';

/**
 * Configuration parameters for specific traffic sign speed rules and penalties.
 */
export interface SignRuleConfig {
  signId: InfrastructureType;
  name: string;
  description: string;
  iconCode: string;
  baseSpeedKmh: number;
  speedType?: 'relative' | 'slow' | 'slower' | 'dismount' | 'custom';
  flatPenaltySeconds: number;
  comfort?: ComfortLevel;
}

/**
 * Configuration parameters for specific road type speed rules and penalties.
 */
export interface RoadRuleConfig {
  roadId: RoadType;
  name: string;
  baseSpeedKmh: number;
  speedType?: 'relative' | 'slow' | 'slower' | 'dismount' | 'custom';
  flatPenaltySeconds: number;
  comfort?: ComfortLevel;
}

/**
 * Configured average crossing wait times for signals, yield signs, stops, and zebra crossings.
 * Serves as both user-config and algorithm-impact as it contains direct numerical values.
 */
export interface NodeDelayConfig {
  signalSeconds: number;
  yieldSeconds: number;
  stopSeconds: number;
  crossingSeconds: number;
}

/**
 * Resolved numerical metrics for a single map feature used during cost calculations.
 */
export interface ResolvedEdgeImpact {
  effectiveSpeedMs: number;
  flatPenaltySeconds: number;
  comfort: ComfortLevel;
}

/**
 * Resolved edge impacts mapped by infrastructure type.
 */
export type RouterSignImpacts = Record<InfrastructureType, ResolvedEdgeImpact>;

/**
 * Resolved edge impacts mapped by road classification.
 */
export type RouterRoadImpacts = Record<RoadType, ResolvedEdgeImpact>;

/**
 * Configured average wait/penalty times for directional turns.
 */
export interface TurnRuleConfig {
  rightTurnPenaltySeconds: number;
  leftTurnPenaltySeconds: number;
  greenArrowRightTurnSeconds: number;
  indirectLeftTurnSeconds: number;
  uTurnPenaltySeconds: number;
}

/**
 * Semantic classifications for custom turn overrides.
 */
export type SemanticTurnType =
  | 'right_turn'
  | 'left_turn'
  | 'green_arrow_right'
  | 'indirect_left'
  | 'u_turn';

/**
 * Aggregated configuration wrapper mapping signs, roads, and intersection node delays.
 */
export interface RulesConfiguration {
  signs: Record<InfrastructureType, SignRuleConfig>;
  roads: Record<RoadType, RoadRuleConfig>;
  nodeDelays: NodeDelayConfig;
  turns: TurnRuleConfig;
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
