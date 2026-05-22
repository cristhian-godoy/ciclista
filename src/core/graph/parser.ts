import type { IGraphParser, StreetGraph, GraphNode, GraphEdge } from '../types';

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula. Returns distance in meters.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class OSMGraphParser implements IGraphParser {
  parse(rawData: any): StreetGraph {
    const graph: StreetGraph = { nodes: new Map() };

    if (!rawData || !rawData.elements || rawData.elements.length === 0) {
      console.warn('Empty or invalid OSM raw data. Loading mock graph instead.');
      return this.loadMockGraph();
    }

    const tempNodes = new Map<string, GraphNode>();

    // 1. First pass: Collect all node coordinates and tags
    for (const el of rawData.elements) {
      if (el.type === 'node') {
        tempNodes.set(el.id.toString(), {
          id: el.id.toString(),
          lat: el.lat,
          lng: el.lon,
          tags: el.tags || {},
        });
      }
    }

    // 2. Second pass: Process ways and construct edges
    for (const el of rawData.elements) {
      if (el.type === 'way') {
        const wayTags = el.tags || {};
        const highway = wayTags.highway;

        // Skip non-bikeable major roads (motorways) and irrelevant features
        if (!highway || ['motorway', 'motorway_link', 'proposed', 'construction', 'abandoned'].includes(highway)) {
          continue;
        }

        const nodesList: number[] = el.nodes || [];
        if (nodesList.length < 2) continue;

        // Determine speed limits based on OSM tags or cycling defaults
        let speedLimit = 5.0; // Default: ~18 km/h cycling speed
        if (wayTags.maxspeed) {
          const limitKmh = parseInt(wayTags.maxspeed);
          if (!isNaN(limitKmh)) {
            // Speed limit in m/s (usually cars, we default lower for cyclists)
            speedLimit = Math.min(5.0, (limitKmh * 1000) / 3600);
          }
        }

        // Determine if it is one-way for cyclists
        // In OSM, cycleways are often double-way even on one-way streets, unless tagged otherwise
        const oneway = wayTags.oneway === 'yes';
        const onewayBicycle = wayTags['oneway:bicycle'] === 'yes' || (wayTags['oneway:bicycle'] === undefined && oneway);

        for (let i = 0; i < nodesList.length - 1; i++) {
          const uId = nodesList[i].toString();
          const vId = nodesList[i + 1].toString();

          const uNode = tempNodes.get(uId);
          const vNode = tempNodes.get(vId);

          // Ensure both nodes are parsed and available
          if (!uNode || !vNode) continue;

          const dist = haversineDistance(uNode.lat, uNode.lng, vNode.lat, vNode.lng);

          // Ensure nodes exist in our graph adjacency list
          if (!graph.nodes.has(uId)) {
            graph.nodes.set(uId, { node: uNode, edges: [] });
          }
          if (!graph.nodes.has(vId)) {
            graph.nodes.set(vId, { node: vNode, edges: [] });
          }

          // Outgoing edge u -> v
          const edgeUV: GraphEdge = {
            target: vId,
            distance: dist,
            name: wayTags.name,
            tags: wayTags,
            speedLimit,
          };
          graph.nodes.get(uId)!.edges.push(edgeUV);

          // If not one-way, add outgoing edge v -> u
          if (!onewayBicycle) {
            const edgeVU: GraphEdge = {
              target: uId,
              distance: dist,
              name: wayTags.name,
              tags: wayTags,
              speedLimit,
            };
            graph.nodes.get(vId)!.edges.push(edgeVU);
          }
        }
      }
    }

    return graph;
  }

  /**
   * Generates a sample mock commute graph to run the UI immediately in sandbox/offline mode.
   */
  private loadMockGraph(): StreetGraph {
    const graph: StreetGraph = { nodes: new Map() };
    
    // Coordinates around Amsterdam center as a mock
    const nodesData: GraphNode[] = [
      { id: '1', lat: 52.3702, lng: 4.8952, tags: { name: 'Home' } },
      { id: '2', lat: 52.3715, lng: 4.8970, tags: { highway: 'traffic_signals', name: 'Busy Intersection' } },
      { id: '3', lat: 52.3730, lng: 4.8990, tags: { name: 'Quiet Street' } },
      { id: '4', lat: 52.3708, lng: 4.8985, tags: { highway: 'traffic_signals', name: 'Alternative Light' } },
      { id: '5', lat: 52.3725, lng: 4.9015, tags: { name: 'Office' } },
    ];

    nodesData.forEach(n => {
      graph.nodes.set(n.id, { node: n, edges: [] });
    });

    const addBiEdge = (uId: string, vId: string, name: string, distance: number, tags: Record<string, string> = {}) => {
      const u = graph.nodes.get(uId)!;
      const v = graph.nodes.get(vId)!;
      
      u.edges.push({ target: vId, distance, name, tags, speedLimit: 5 });
      v.edges.push({ target: uId, distance, name, tags, speedLimit: 5 });
    };

    // Route A (Via Intersections with lights)
    addBiEdge('1', '2', 'Damrak Street', 180, { highway: 'tertiary' });
    addBiEdge('2', '3', 'Oudezijds Voorburgwal', 220, { highway: 'residential', cycleway: 'track' });
    addBiEdge('3', '5', 'Geldersekade Street', 250, { highway: 'tertiary' });

    // Route B (Via quieter side paths / alternative lights)
    addBiEdge('1', '4', 'Nes Alley', 150, { highway: 'residential', cycleway: 'lane' });
    addBiEdge('4', '5', 'Kloveniersburgwal', 350, { highway: 'service' });

    return graph;
  }
}
