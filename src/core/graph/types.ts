/**
 * Represents a single node (vertex) in the street routing network.
 * Typically corresponds to an OpenStreetMap node containing geographic coordinates
 * and associated attributes.
 */
export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

/**
 * Represents a directed link (edge) between two nodes in the routing network.
 * Contains information about travel distance, street name, speed limits,
 * and raw OpenStreetMap tags.
 */
export interface GraphEdge {
  target: string;
  distance: number;
  name?: string;
  speedLimit?: number;
  tags: Record<string, string>;
}

/**
 * Represents a complete street network graph as an adjacency list,
 * mapping node IDs to their respective GraphNode structure and outgoing edges.
 */
export interface StreetGraph {
  nodes: Map<
    string,
    {
      node: GraphNode;
      edges: GraphEdge[];
    }
  >;
}

/**
 * Defines the contract for parsing raw input data into a structured StreetGraph.
 */
export interface IGraphParser {
  parse(rawData: unknown): StreetGraph;
}
