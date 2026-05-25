import { haversineDistance } from '../graph/parser';
import type { GraphEdge, StreetGraph } from '../graph/types';
import { ROUTING_CONFIG } from './constants';
import type { Coordinate } from './types';

/**
 * Calculates the turn penalty (in seconds) between three points: p -> c -> n.
 */
export function calculateTurnPenalty(p: Coordinate, c: Coordinate, n: Coordinate): number {
  const cosLat = Math.cos((c.lat * Math.PI) / 180);
  const v1x = (c.lng - p.lng) * cosLat;
  const v1y = c.lat - p.lat;
  const v2x = (n.lng - c.lng) * cosLat;
  const v2y = n.lat - c.lat;

  const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (len1 > 1e-7 && len2 > 1e-7) {
    const dot = v1x * v2x + v1y * v2y;
    const cosTheta = dot / (len1 * len2);

    // U-turn or very sharp turn (angle > 135 deg)
    if (cosTheta < -0.7) {
      return ROUTING_CONFIG.U_TURN_PENALTY_SECONDS;
    }
    // Normal turn (angle between 45 and 135 deg)
    else if (cosTheta >= -0.7 && cosTheta <= 0.7) {
      return ROUTING_CONFIG.NORMAL_TURN_PENALTY_SECONDS;
    }
  }
  return 0;
}

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
