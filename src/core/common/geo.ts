import type { Coordinate } from './types';
import type { StreetGraph } from '../graph/types';
import { findNearestEdge } from '../router/router';

// Helper to compute a bounding box enclosing two coordinates with padding
export function calculateBoundingBox(
  c1: Coordinate | null,
  c2: Coordinate | null,
): [number, number, number, number] {
  if (!c1 || !c2) {
    // Default bounding box for Munich center
    const center = { lat: 48.13715, lng: 11.5754 };
    const latMargin = 0.015;
    const lngMargin = 0.02;
    return [
      center.lat - latMargin,
      center.lng - lngMargin,
      center.lat + latMargin,
      center.lng + lngMargin,
    ];
  }

  const minLat = Math.min(c1.lat, c2.lat);
  const maxLat = Math.max(c1.lat, c2.lat);
  const minLng = Math.min(c1.lng, c2.lng);
  const maxLng = Math.max(c1.lng, c2.lng);

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  // Generous padding: 30% of route span, or at least ~1.5km to allow alternate paths
  const latMargin = Math.max(latSpan * 0.3, 0.015);
  const lngMargin = Math.max(lngSpan * 0.3, 0.02);

  return [minLat - latMargin, minLng - lngMargin, maxLat + latMargin, maxLng + lngMargin];
}

// Helper to check if coordinate is inside any loaded bounding boxes
export function isInsideLoadedArea(
  coord: Coordinate,
  loadedBBoxes: [number, number, number, number][],
): boolean {
  return loadedBBoxes.some((bbox) => {
    const [minLat, minLng, maxLat, maxLng] = bbox;
    return coord.lat >= minLat && coord.lat <= maxLat && coord.lng >= minLng && coord.lng <= maxLng;
  });
}

// Helper to snap coordinates to the nearest edge if within 3 meters (house-pinning safety)
export function snapCoordinateToEdge(coord: Coordinate, graph: StreetGraph | null): Coordinate {
  if (!graph) return coord;
  const nearestEdge = findNearestEdge(graph, coord);
  if (nearestEdge && nearestEdge.distance < 3) {
    return nearestEdge.projected;
  }
  return coord;
}
