/**
 * Available bicycle routing profiles representing different riding speeds and preferences.
 */
export type BikeProfileId = 'slow' | 'normal' | 'ebike' | 'road' | 'custom';

/**
 * Bike configuration mapping user-selected bike profile properties (e.g. max speed)
 * to physical parameters used by the router.
 */
export interface BikeConfig {
  id: BikeProfileId;
  customSpeedKmh?: number;
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
 * Semantic classifications for custom turn overrides.
 */
export type SemanticTurnType =
  | 'right_turn'
  | 'left_turn'
  | 'green_arrow_right'
  | 'indirect_left'
  | 'u_turn';

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
 * Aggregated configuration wrapper mapping signs, roads, and intersection node delays.
 */
export interface RulesConfiguration {
  signs: Record<InfrastructureType, SignRuleConfig>;
  roads: Record<RoadType, RoadRuleConfig>;
  nodeDelays: NodeDelayConfig;
  turns: TurnRuleConfig;
}

/**
 * Represents custom user configurations and overrides applied locally
 * to override default routing behaviors, node delays, notes, or rules configurations.
 */
export interface LocalOverrides {
  nodeDelays: Map<string, number>;
  nodeNotes: Map<string, string>;
  nodeTurns: Map<string, Record<string, SemanticTurnType>>;
  rulesConfig?: RulesConfiguration;
  bikeConfig?: BikeConfig;
}
