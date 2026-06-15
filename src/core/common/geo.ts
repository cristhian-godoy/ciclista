import type { StreetGraph } from '../graph/types';
import { ROUTING_CONFIG } from './constants';
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
    const fallbackLat = c1?.lat ?? c2?.lat ?? 48.13715;
    const fallbackLng = c1?.lng ?? c2?.lng ?? 11.5754;
    return [fallbackLat - 0.007, fallbackLng - 0.01, fallbackLat + 0.007, fallbackLng + 0.01];
  }

  const minLat = Math.min(c1.lat, c2.lat);
  const maxLat = Math.max(c1.lat, c2.lat);
  const minLng = Math.min(c1.lng, c2.lng);
  const maxLng = Math.max(c1.lng, c2.lng);

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  // Generous padding: 30% of route span, or at least minimum fallback margins (0.007 / 0.01)
  const latMargin = Math.max(latSpan * 0.3, 0.007);
  const lngMargin = Math.max(lngSpan * 0.3, 0.01);

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

/**
 * Represents a geographical grid cell index for spatial partitioning.
 */
export interface GridCell {
  latIdx: number;
  lngIdx: number;
}

export const GRID_CONFIG = {
  CELL_SIZE_LAT: 0.015,
  CELL_SIZE_LNG: 0.02,
} as const;

/**
 * Calculates all grid cells intersecting a given bounding box.
 */
export function getGridCellsForBBox(bbox: [number, number, number, number]): GridCell[] {
  const [minLat, minLng, maxLat, maxLng] = bbox;
  const startLatIdx = Math.floor(minLat / GRID_CONFIG.CELL_SIZE_LAT);
  const endLatIdx = Math.floor(maxLat / GRID_CONFIG.CELL_SIZE_LAT);
  const startLngIdx = Math.floor(minLng / GRID_CONFIG.CELL_SIZE_LNG);
  const endLngIdx = Math.floor(maxLng / GRID_CONFIG.CELL_SIZE_LNG);

  const cells: GridCell[] = [];
  for (let latIdx = startLatIdx; latIdx <= endLatIdx; latIdx++) {
    for (let lngIdx = startLngIdx; lngIdx <= endLngIdx; lngIdx++) {
      cells.push({ latIdx, lngIdx });
    }
  }
  return cells;
}

/**
 * Returns the exact bounding box for a specific grid cell.
 */
export function getBBoxForGridCell(cell: GridCell): [number, number, number, number] {
  const minLat = parseFloat((cell.latIdx * GRID_CONFIG.CELL_SIZE_LAT).toFixed(6));
  const minLng = parseFloat((cell.lngIdx * GRID_CONFIG.CELL_SIZE_LNG).toFixed(6));
  const maxLat = parseFloat(((cell.latIdx + 1) * GRID_CONFIG.CELL_SIZE_LAT).toFixed(6));
  const maxLng = parseFloat(((cell.lngIdx + 1) * GRID_CONFIG.CELL_SIZE_LNG).toFixed(6));
  return [minLat, minLng, maxLat, maxLng];
}
