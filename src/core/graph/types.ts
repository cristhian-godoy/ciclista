export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

export interface GraphEdge {
  target: string;
  distance: number;
  name?: string;
  speedLimit?: number;
  tags: Record<string, string>;
}

export interface StreetGraph {
  nodes: Map<
    string,
    {
      node: GraphNode;
      edges: GraphEdge[];
    }
  >;
}

export interface IGraphParser {
  parse(rawData: unknown): StreetGraph;
}
