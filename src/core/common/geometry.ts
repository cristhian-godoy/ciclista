import type { GraphEdge, StreetGraph } from '../graph/types';
import { haversineDistance } from './geo';
import type { Coordinate } from './types';

/**
 * Snaps a raw lat/lng coordinate to the nearest topological node in the graph.
 */
export function findNearestNode(graph: StreetGraph, coord: Coordinate): string | null {
  let minDistance = Infinity;
  let nearestId: string | null = null;

  for (const [id, entry] of graph.nodes.entries()) {
    const dist = haversineDistance(coord.lat, coord.lng, entry.node.lat, entry.node.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestId = id;
    }
  }

  return nearestId;
}

/**
 * Projects a point onto a line segment defined by points a and b.
 * Returns the projected coordinate, clamped to the segment.
 */
export function projectPointOnSegment(p: Coordinate, a: Coordinate, b: Coordinate): Coordinate {
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const abx = (b.lng - a.lng) * cosLat;
  const aby = b.lat - a.lat;

  const apx = (p.lng - a.lng) * cosLat;
  const apy = p.lat - a.lat;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 < 1e-14) return { lat: a.lat, lng: a.lng };

  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));

  return {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
}

/**
 * Calculates the projection factor t of point p onto line segment a-b.
 */
export function getProjectionT(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const abx = (b.lng - a.lng) * cosLat;
  const aby = b.lat - a.lat;

  const apx = (p.lng - a.lng) * cosLat;
  const apy = p.lat - a.lat;

  const abLen2 = abx * abx + aby * aby;
  if (abLen2 < 1e-14) return 0;

  const t = (apx * abx + apy * aby) / abLen2;
  return Math.max(0, Math.min(1, t));
}

/**
 * Represents a reference to a specific street edge in relation to a target coordinate.
 * Used for map snapping and nearest-edge calculations.
 */
export interface EdgeRef {
  uId: string;
  vId: string;
  distance: number;
  projected: Coordinate;
  edge: GraphEdge;
}

/**
 * Finds the nearest edge in the graph to a given coordinate.
 */
export function findNearestEdge(graph: StreetGraph, coord: Coordinate): EdgeRef | null {
  let minDistance = Infinity;
  let bestEdge: EdgeRef | null = null;

  for (const [uId, entry] of graph.nodes.entries()) {
    const u = entry.node;
    for (const edge of entry.edges) {
      const vId = edge.target;
      const vEntry = graph.nodes.get(vId);
      if (!vEntry) continue;
      const v = vEntry.node;

      // Project coord onto segment u -> v
      const proj = projectPointOnSegment(coord, u, v);

      // Calculate physical distance from coord to projected point
      const dist = haversineDistance(coord.lat, coord.lng, proj.lat, proj.lng);
      if (dist < minDistance) {
        minDistance = dist;
        bestEdge = {
          uId,
          vId,
          distance: dist,
          projected: proj,
          edge,
        };
      }
    }
  }

  return bestEdge;
}
