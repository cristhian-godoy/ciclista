/**
 * Core types and interfaces for the Custom Cycling Route Planner.
 * Designed to decouple graph representation, routing algorithms, 
 * data source formats, and storage mechanisms.
 */

/**
 * Represents a geographical coordinate.
 */
export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Represents a Node in the street network (e.g., intersections, traffic signals, turn points).
 */
export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

/**
 * Represents a directed Edge between two nodes in the street network.
 */
export interface GraphEdge {
  /** The target node ID */
  target: string;
  /** Physical distance of the edge in meters */
  distance: number;
  /** Name of the street/path */
  name?: string;
  /** Speed limit of the edge in m/s */
  speedLimit?: number;
  /** OSM tags associated with the street segment */
  tags: Record<string, string>;
}

/**
 * Topological representation of the street network as a directed adjacency map.
 */
export interface StreetGraph {
  /** Node ID to Node metadata and directed outgoing edges */
  nodes: Map<string, {
    node: GraphNode;
    edges: GraphEdge[];
  }>;
}

/**
 * Interface for converting raw input data (e.g., Overpass API JSON) 
 * into a clean, queryable StreetGraph.
 */
export interface IGraphParser {
  /** Parses raw input string or JSON object into a StreetGraph */
  parse(rawData: unknown): StreetGraph;
}

/**
 * Bike speed profile selected by the user.
 * Scales all resolved speeds proportionally.
 */
export type BikeProfile = 'slow' | 'normal' | 'ebike';

/**
 * User-defined local overrides for nodes or edges.
 */
export interface LocalOverrides {
  /** Map of Node ID to wait time in seconds (e.g. traffic signal delay) */
  nodeDelays: Map<string, number>;
  /** Map of Node ID to custom descriptive notes or attributes */
  nodeNotes: Map<string, string>;
  /** Map of Node ID to turn penalty tags (e.g. hard-left settings) */
  nodeTurns: Map<string, Record<string, unknown>>;
  /** Global settings override for traffic signs and road rule weights */
  rulesConfig?: RulesConfiguration;
  /** Selected bike speed profile */
  bikeProfile?: BikeProfile;
}

/**
 * Interface for reading and writing user preferences and local node/edge overrides.
 */
export interface IStorageProvider {
  /** Retrieves all saved local overrides */
  getOverrides(): Promise<LocalOverrides>;
  /** Saves a delay override for a specific node */
  saveNodeDelay(nodeId: string, delaySeconds: number): Promise<void>;
  /** Saves notes for a specific node */
  saveNodeNotes(nodeId: string, notes: string): Promise<void>;
  /** Clears overrides for a specific node */
  clearNodeOverrides(nodeId: string): Promise<void>;
}

/**
 * Custom weighting function for the routing algorithm.
 * Computes the "cost" (typically in seconds of travel time) of traversal.
 * 
 * @param sourceId The starting node ID of the edge
 * @param edge The edge properties being traversed
 * @param targetId The destination node ID of the edge
 * @param overrides The user's custom node/edge weights
 */
export type CostFunction = (
  sourceId: string,
  edge: GraphEdge,
  targetId: string,
  overrides: LocalOverrides,
  graph: StreetGraph
) => number;

/**
 * Result of a routing calculation.
 */
export interface RouteResult {
  /** Array of ordered node IDs forming the path */
  pathNodeIds: string[];
  /** Array of coordinates representing the line string */
  coordinates: Coordinate[];
  /** Total computed cost (estimated time in seconds) */
  totalDurationSeconds: number;
  /** Total length of the route in meters */
  totalDistanceMeters: number;
  /** List of street names traversed in order */
  streets: string[];
  /** Total number of traffic signals encountered */
  trafficSignalsCount: number;
  /** Total number of yield signs encountered */
  yieldCount: number;
  /** Total number of traffic signals encountered (unified count) */
  signalCount: number;
  /** Total number of pedestrian crossings encountered */
  crossingCount: number;
  /** Detailed list of edges traversed in the route for debugging and inspection */
  edges?: {
    sourceId: string;
    targetId: string;
    name: string;
    distance: number;
    highway: string;
    tags: Record<string, string>;
    cost: number;
    /** Matched German traffic sign code, if any */
    matchedSign: string | null;
    /** Matched road classification */
    matchedRoad: string;
  }[];
}

/**
 * Interface for pathfinding algorithms (e.g. Dijkstra, A*).
 */
export interface IRouter {
  /**
   * Calculates the optimal route between start and end coordinates.
   * 
   * @param graph The street network graph
   * @param start Coords of starting point
   * @param end Coords of ending point
   * @param costFn The custom weight cost function
   * @param overrides User-defined overrides (e.g. traffic light timings)
   */
  findRoute(
    graph: StreetGraph,
    start: Coordinate,
    end: Coordinate,
    costFn: CostFunction,
    overrides: LocalOverrides
  ): RouteResult | null;
}

/**
 * German Traffic Signs that have specific legal requirements for cyclists.
 */
export enum GermanSign {
  VZ_242_1 = 'Vz_242.1', // Fußgängerzone (Pedestrian Zone)
  VZ_239 = 'Vz_239',     // Gehweg (Sidewalk/Footway)
  VZ_240 = 'Vz_240',     // Gemeinsamer Geh- und Radweg (Shared path)
  VZ_241 = 'Vz_241',     // Getrennter Geh- und Radweg (Segregated path)
  VZ_325_1 = 'Vz_325.1', // Verkehrsberuhigter Bereich (Living Street)
  VZ_244_1 = 'Vz_244.1', // Fahrradstraße (Bicycle Street)
}

/**
 * Standard OSM road classifications used for base speed estimation.
 */
export enum RoadType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  RESIDENTIAL = 'residential',
  SERVICE = 'service',
  PATH_DEFAULT = 'path_default',
}

/**
 * Configuration for a traffic sign rule.
 */
export interface SignRuleConfig {
  signId: GermanSign;
  name: string;
  description: string;
  iconCode: string;
  baseSpeedKmh: number;
  flatPenaltySeconds: number;
  dismountRequired: boolean;
}

/**
 * Configuration for a road type rule.
 */
export interface RoadRuleConfig {
  roadId: RoadType;
  name: string;
  baseSpeedKmh: number;
  flatPenaltySeconds: number;
}

/**
 * Configuration schema for the German Road Rules settings.
 */
export interface RulesConfiguration {
  signs: Record<GermanSign, SignRuleConfig>;
  roads: Record<RoadType, RoadRuleConfig>;
}

