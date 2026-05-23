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

/**
 * Interface representing a raw OSM node or way element from Overpass API.
 */
interface OSMElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
}

/**
 * Interface representing raw Overpass API response JSON.
 */
interface OSMRawData {
  elements?: OSMElement[];
}

export class OSMGraphParser implements IGraphParser {
  parse(rawData: unknown): StreetGraph {
    const graph: StreetGraph = { nodes: new Map() };
    const data = rawData as OSMRawData | null | undefined;

    if (!data || !data.elements || data.elements.length === 0) {
      console.warn('Empty or invalid OSM raw data. Loading mock graph instead.');
      return this.loadMockGraph();
    }

    const tempNodes = new Map<string, GraphNode>();

    // 1. First pass: Collect all node coordinates and tags
    for (const el of data.elements) {
      if (el.type === 'node') {
        tempNodes.set(el.id.toString(), {
          id: el.id.toString(),
          lat: el.lat || 0,
          lng: el.lon || 0,
          tags: el.tags || {},
        });
      }
    }

    // 2. Second pass: Process ways and construct edges
    for (const el of data.elements) {
      if (el.type === 'way') {
        const wayTags = el.tags || {};
        const highway = wayTags.highway;

        // Skip non-bikeable major roads (motorways) and irrelevant features
        if (!highway || ['motorway', 'motorway_link', 'proposed', 'construction', 'abandoned'].includes(highway)) {
          continue;
        }

        // Skip explicitly non-bikeable paths/roads
        if (wayTags.bicycle === 'no' || wayTags.access === 'no') {
          continue;
        }

        // Skip physical steps (stairs)
        if (highway === 'steps') {
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
    
    // Coordinates around Munich center as a mock
    const nodesData: GraphNode[] = [
      { id: '1', lat: 48.13715, lng: 11.5754, tags: { name: 'Home (Marienplatz)' } },
      { id: '2', lat: 48.1428, lng: 11.5775, tags: { highway: 'traffic_signals', name: 'Odeonsplatz Intersection' } },
      { id: '3', lat: 48.1390, lng: 11.5810, tags: { highway: 'give_way', name: 'Maximilianstrasse Yield' } },
      { id: '4', lat: 48.1351, lng: 11.5760, tags: { highway: 'traffic_signals', name: 'Viktualienmarkt Light' } },
      { id: '5', lat: 48.1350, lng: 11.5820, tags: { name: 'Office (Isartor)' } },
      { id: '6', lat: 48.1380, lng: 11.5780, tags: { highway: 'stop', name: 'Residenzstrasse Stop Sign' } },
      { id: '7', lat: 48.1405, lng: 11.5795, tags: { highway: 'crossing', crossing: 'controlled', name: 'Pedestrian Crossing' } },
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

    // Route A (Via Intersections with lights and controls)
    addBiEdge('1', '2', 'Theatinerstraße', 180, { highway: 'tertiary' });
    addBiEdge('2', '7', 'Residenzstraße North', 110, { highway: 'residential', cycleway: 'track' });
    addBiEdge('7', '3', 'Residenzstraße South', 110, { highway: 'residential', cycleway: 'track' });
    addBiEdge('3', '5', 'Maximilianstraße', 250, { highway: 'tertiary' });

    // Route B (Via stop sign and alternative lights)
    addBiEdge('1', '6', 'Sendlinger Straße North', 75, { highway: 'residential', cycleway: 'lane' });
    addBiEdge('6', '4', 'Sendlinger Straße South', 75, { highway: 'residential', cycleway: 'lane' });
    addBiEdge('4', '5', 'Tal', 350, { highway: 'service' });

    return graph;
  }
}
