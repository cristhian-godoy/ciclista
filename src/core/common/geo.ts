import type { StreetGraph } from '../graph/types';
import { CHUNK_CONFIG, ROUTING_CONFIG } from './constants';
import { findNearestEdge } from './geometry';
import { logger } from './logger';
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

/**
 * Translates a latitude and longitude coordinate into a chunk ID.
 */
export function coordToChunkId(lat: number, lng: number): string {
  const latIdx = Math.floor(lat / CHUNK_CONFIG.SIZE_LAT);
  const lngIdx = Math.floor(lng / CHUNK_CONFIG.SIZE_LNG);
  return `${latIdx},${lngIdx}`;
}

/**
 * Calculates the bounding box for a specific chunk ID.
 */
export function getChunkBBox(chunkId: string): [number, number, number, number] {
  const [latIdxStr, lngIdxStr] = chunkId.split(',');
  const latIdx = parseInt(latIdxStr, 10);
  const lngIdx = parseInt(lngIdxStr, 10);
  const minLat = latIdx * CHUNK_CONFIG.SIZE_LAT;
  const minLng = lngIdx * CHUNK_CONFIG.SIZE_LNG;
  const maxLat = (latIdx + 1) * CHUNK_CONFIG.SIZE_LAT;
  const maxLng = (lngIdx + 1) * CHUNK_CONFIG.SIZE_LNG;
  return [
    parseFloat(minLat.toFixed(6)),
    parseFloat(minLng.toFixed(6)),
    parseFloat(maxLat.toFixed(6)),
    parseFloat(maxLng.toFixed(6)),
  ];
}

/**
 * Translates a bounding box into a list of chunk IDs that intersect it.
 * Returns an empty array if the requested area exceeds the chunk loading limit.
 */
export function getChunksInBBox(bbox: [number, number, number, number]): string[] {
  const [minLat, minLng, maxLat, maxLng] = bbox;
  const startLatIdx = Math.floor(minLat / CHUNK_CONFIG.SIZE_LAT);
  const endLatIdx = Math.floor(maxLat / CHUNK_CONFIG.SIZE_LAT);
  const startLngIdx = Math.floor(minLng / CHUNK_CONFIG.SIZE_LNG);
  const endLngIdx = Math.floor(maxLng / CHUNK_CONFIG.SIZE_LNG);

  const numLat = endLatIdx - startLatIdx + 1;
  const numLng = endLngIdx - startLngIdx + 1;
  const totalChunks = numLat * numLng;

  if (totalChunks > CHUNK_CONFIG.MAX_CHUNKS_LIMIT) {
    logger.warn(
      `Requested area contains ${totalChunks} chunks, exceeding limit of ${CHUNK_CONFIG.MAX_CHUNKS_LIMIT}.`,
    );
    return [];
  }

  const chunkIds: string[] = [];
  for (let latIdx = startLatIdx; latIdx <= endLatIdx; latIdx++) {
    for (let lngIdx = startLngIdx; lngIdx <= endLngIdx; lngIdx++) {
      chunkIds.push(`${latIdx},${lngIdx}`);
    }
  }
  return chunkIds;
}

/**
 * Computes the minimal bounding box encompassing all provided chunk IDs.
 */
export function mergeChunksToBBox(chunkIds: string[]): [number, number, number, number] {
  if (chunkIds.length === 0) {
    return [0, 0, 0, 0];
  }
  let globalMinLat = Infinity;
  let globalMinLng = Infinity;
  let globalMaxLat = -Infinity;
  let globalMaxLng = -Infinity;

  for (const chunkId of chunkIds) {
    const [minLat, minLng, maxLat, maxLng] = getChunkBBox(chunkId);
    if (minLat < globalMinLat) globalMinLat = minLat;
    if (minLng < globalMinLng) globalMinLng = minLng;
    if (maxLat > globalMaxLat) globalMaxLat = maxLat;
    if (maxLng > globalMaxLng) globalMaxLng = maxLng;
  }

  return [
    parseFloat(globalMinLat.toFixed(6)),
    parseFloat(globalMinLng.toFixed(6)),
    parseFloat(globalMaxLat.toFixed(6)),
    parseFloat(globalMaxLng.toFixed(6)),
  ];
}

/**
 * Calculates the distance between two nearby points on the Earth's surface
 * using a fast flat-earth Pythagorean (equirectangular) approximation.
 * Returns distance in meters.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of Earth in meters
  const degToRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * degToRad;
  const dLon = (lon2 - lon1) * degToRad;
  const meanLat = ((lat1 + lat2) / 2) * degToRad;
  const x = dLon * Math.cos(meanLat);
  const y = dLat;
  return R * Math.sqrt(x * x + y * y);
}
