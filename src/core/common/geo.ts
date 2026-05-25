import type { StreetGraph } from '../graph/types';
import { MAP_CONFIG, ROUTING_CONFIG } from './constants';
import { findNearestEdge } from './geometry';
import type { Coordinate } from './types';

// Helper to compute a bounding box enclosing two coordinates with padding
/**
 * Calculates a bounding box encompassing two coordinates with safety padding.
 */
export function calculateBoundingBox(
  c1: Coordinate | null,
  c2: Coordinate | null,
): [number, number, number, number] {
  if (!c1 || !c2) {
    const preset = MAP_CONFIG.PRESETS[MAP_CONFIG.DEFAULT_PRESET];
    return [
      preset.center.lat - preset.latMargin,
      preset.center.lng - preset.lngMargin,
      preset.center.lat + preset.latMargin,
      preset.center.lng + preset.lngMargin,
    ];
  }

  const minLat = Math.min(c1.lat, c2.lat);
  const maxLat = Math.max(c1.lat, c2.lat);
  const minLng = Math.min(c1.lng, c2.lng);
  const maxLng = Math.max(c1.lng, c2.lng);

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  const defaultPreset = MAP_CONFIG.PRESETS[MAP_CONFIG.DEFAULT_PRESET];
  // Generous padding: 30% of route span, or at least configured margins to allow alternate paths
  const latMargin = Math.max(latSpan * 0.3, defaultPreset.latMargin);
  const lngMargin = Math.max(lngSpan * 0.3, defaultPreset.lngMargin);

  return [minLat - latMargin, minLng - lngMargin, maxLat + latMargin, maxLng + lngMargin];
}

// Helper to check if coordinate is inside any loaded bounding boxes
/**
 * Checks if a coordinate is within any of the loaded bounding boxes.
 */
export function isInsideLoadedArea(
  coord: Coordinate,
  loadedBBoxes: [number, number, number, number][],
): boolean {
  return loadedBBoxes.some((bbox) => {
    const [minLat, minLng, maxLat, maxLng] = bbox;
    return coord.lat >= minLat && coord.lat <= maxLat && coord.lng >= minLng && coord.lng <= maxLng;
  });
}

// Helper to snap coordinates to the nearest edge if within snapping distance (house-pinning safety)
/**
 * Snaps a coordinate to the nearest graph edge if it is within a threshold distance.
 */
export function snapCoordinateToEdge(coord: Coordinate, graph: StreetGraph | null): Coordinate {
  if (!graph) return coord;
  const nearestEdge = findNearestEdge(graph, coord);
  if (nearestEdge && nearestEdge.distance < ROUTING_CONFIG.SNAPPING_DISTANCE_METERS) {
    return nearestEdge.projected;
  }
  return coord;
}
