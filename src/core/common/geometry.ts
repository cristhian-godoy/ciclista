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

/**
 * Finds all directed graph edge keys (e.g. 'sourceId->targetId') that fall within
 * a specified radius (in meters) from a center geographic coordinate.
 *
 * @param graph - The street network graph to search within.
 * @param center - The central geographic coordinate.
 * @param radiusMeters - The search radius in meters.
 * @returns Array of directed edge key strings matching 'sourceId->targetId'.
 */
export function findEdgesWithinRadius(
  graph: StreetGraph,
  center: Coordinate,
  radiusMeters: number,
): string[] {
  if (radiusMeters < 0) {
    return [];
  }

  const matchingEdgeKeys = new Set<string>();

  for (const [uId, entry] of graph.nodes.entries()) {
    const u = entry.node;
    for (const edge of entry.edges) {
      const vId = edge.target;
      const vEntry = graph.nodes.get(vId);
      if (!vEntry) continue;
      const v = vEntry.node;

      const proj = projectPointOnSegment(center, u, v);
      const dist = haversineDistance(center.lat, center.lng, proj.lat, proj.lng);

      if (dist <= radiusMeters) {
        matchingEdgeKeys.add(`${uId}->${vId}`);
      }
    }
  }

  return Array.from(matchingEdgeKeys);
}

/**
 * GeoJSON Polygon geometry representing an enclosed geographical boundary.
 */
export interface GeoPolygonGeometry {
  type: 'Polygon';
  coordinates: [number, number][][];
}

/**
 * Generates a GeoJSON Polygon representing a circle on the globe
 * centered at a given coordinate with a specified radius in meters.
 *
 * @param center - Central geographic coordinate { lat, lng }.
 * @param radiusMeters - Radius in meters.
 * @param points - Number of polygon vertices (default: 64).
 * @returns GeoJSON Polygon geometry.
 */
export function createGeoJSONCircle(
  center: Coordinate,
  radiusMeters: number,
  points: number = 64,
): GeoPolygonGeometry {
  if (radiusMeters <= 0) {
    return {
      type: 'Polygon',
      coordinates: [[]],
    };
  }

  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  const earthRadiusKm = 6371;
  const distanceRatio = km / earthRadiusKm;
  const centerLatRad = (center.lat * Math.PI) / 180;
  const centerLngRad = (center.lng * Math.PI) / 180;

  for (let i = 0; i < points; i++) {
    const bearing = (i * 2 * Math.PI) / points;
    const latRad = Math.asin(
      Math.sin(centerLatRad) * Math.cos(distanceRatio) +
        Math.cos(centerLatRad) * Math.sin(distanceRatio) * Math.cos(bearing),
    );
    const lngRad =
      centerLngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distanceRatio) * Math.cos(centerLatRad),
        Math.cos(distanceRatio) - Math.sin(centerLatRad) * Math.sin(latRad),
      );
    coords.push([(lngRad * 180) / Math.PI, (latRad * 180) / Math.PI]);
  }

  if (coords.length > 0) {
    coords.push(coords[0]);
  }

  return {
    type: 'Polygon',
    coordinates: [coords],
  };
}
