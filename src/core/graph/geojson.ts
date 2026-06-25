import { mapOSMNodeToControl } from '../router/rules';
import type { StreetGraph } from './types';

/**
 * Represents a standard GeoJSON Feature object used to map geometry and properties
 * for visualization layers.
 */
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon';
    coordinates: number[] | number[][] | number[][][];
  };
  properties: Record<string, unknown>;
}

/**
 * Container structure grouping street features (lines) and control features (points)
 * formatted as GeoJSON for visualization on the map.
 */
export interface GraphGeoJSON {
  streets: GeoJSONFeature[];
  controls: GeoJSONFeature[];
}

/**
 * Calculates Euclidean distance in meters between two coordinates.
 * Using static Munchen / Amsterdam average latitude cosine projection (~0.67).
 */
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  const cosLat = 0.67;
  return Math.sqrt(dLat * dLat + dLng * cosLat * (dLng * cosLat)) * 111000;
}

/**
 * Converts a StreetGraph representation into GeoJSON street line and control point features
 * for visualization on web map canvases. Group controls within 35m into crossing clusters.
 */
export function convertGraphToGeoJSON(
  graph: StreetGraph,
  customNodeDelays: Map<string, number>,
  showMinorControls: boolean,
): GraphGeoJSON {
  const lineFeatures: GeoJSONFeature[] = [];
  const lightFeatures: GeoJSONFeature[] = [];

  // Find all control nodes (traffic lights, yield signs, stop signs, pedestrian crossings)
  const controlNodes: {
    id: string;
    lat: number;
    lng: number;
    tags: Record<string, string>;
    customDelay: number | null;
    controlType: 'signal' | 'yield' | 'stop' | 'crossing';
  }[] = [];

  graph.nodes.forEach((entry, sourceId) => {
    const u = entry.node;
    const tags = u.tags || {};
    const controlType = mapOSMNodeToControl(tags);

    if (controlType) {
      const hasOverride = customNodeDelays.has(sourceId);
      // Hide minor controls (yield, stop, crossing) by default unless showMinorControls is checked OR they have custom overrides
      if (controlType !== 'signal' && !showMinorControls && !hasOverride) {
        return;
      }

      controlNodes.push({
        id: sourceId,
        lat: u.lat,
        lng: u.lng,
        tags: u.tags,
        customDelay: customNodeDelays.get(sourceId) ?? null,
        controlType,
      });
    }
  });

  // Cluster them (BFS grouping within 35 meters using Spatial Hashing for O(N) performance)
  const visited = new Set<string>();
  const crossings: {
    id: string;
    lat: number;
    lng: number;
    nodeIds: string[];
    controlType: 'signal' | 'yield' | 'stop' | 'crossing';
    hasCustomDelay: boolean;
  }[] = [];

  const CELL_SIZE = 0.000315; // roughly 35 meters in degrees
  const grid = new Map<string, typeof controlNodes>();
  for (const node of controlNodes) {
    const r = Math.floor(node.lat / CELL_SIZE);
    const c = Math.floor(node.lng / CELL_SIZE);
    const key = `${r},${c}`;
    let cell = grid.get(key);
    if (!cell) {
      cell = [];
      grid.set(key, cell);
    }
    cell.push(node);
  }

  for (const node of controlNodes) {
    if (visited.has(node.id)) continue;

    const clusterNodes = [node];
    visited.add(node.id);

    const queue = [node];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const r = Math.floor(current.lat / CELL_SIZE);
      const c = Math.floor(current.lng / CELL_SIZE);

      // Check 9 neighboring cells
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const cell = grid.get(`${r + dr},${c + dc}`);
          if (!cell) continue;
          for (const other of cell) {
            if (visited.has(other.id)) continue;
            if (getDistance(current.lat, current.lng, other.lat, other.lng) <= 35) {
              visited.add(other.id);
              clusterNodes.push(other);
              queue.push(other);
            }
          }
        }
      }
    }

    const avgLat = clusterNodes.reduce((sum, n) => sum + n.lat, 0) / clusterNodes.length;
    const avgLng = clusterNodes.reduce((sum, n) => sum + n.lng, 0) / clusterNodes.length;
    const crossingId = `crossing-${node.id}`;

    // Determine dominant controlType for this cluster: signal > stop > yield > crossing
    let clusterControlType: 'signal' | 'yield' | 'stop' | 'crossing' = 'crossing';
    const types = clusterNodes.map((n) => n.controlType);
    if (types.includes('signal')) {
      clusterControlType = 'signal';
    } else if (types.includes('stop')) {
      clusterControlType = 'stop';
    } else if (types.includes('yield')) {
      clusterControlType = 'yield';
    }

    const hasCustomDelay = clusterNodes.some((n) => n.customDelay !== null);

    crossings.push({
      id: crossingId,
      lat: avgLat,
      lng: avgLng,
      nodeIds: clusterNodes.map((n) => n.id),
      controlType: clusterControlType,
      hasCustomDelay,
    });
  }

  // Add crossing features
  crossings.forEach((crossing) => {
    lightFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [crossing.lng, crossing.lat],
      },
      properties: {
        type: 'crossing',
        crossingId: crossing.id,
        nodeIds: JSON.stringify(crossing.nodeIds),
        controlType: crossing.controlType,
        hasCustomDelay: crossing.hasCustomDelay ? 'true' : 'false',
      },
    });
  });

  // Add individual signal features
  controlNodes.forEach((node) => {
    const parentCrossing = crossings.find((c) => c.nodeIds.includes(node.id));
    lightFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [node.lng, node.lat],
      },
      properties: {
        type: 'signal',
        controlType: node.controlType,
        id: node.id,
        parentCrossingId: parentCrossing ? parentCrossing.id : '',
        tags: JSON.stringify(node.tags),
        name:
          node.tags.name ||
          (node.controlType === 'signal'
            ? 'Traffic Signal'
            : node.controlType === 'yield'
              ? 'Yield Sign'
              : node.controlType === 'stop'
                ? 'Stop Sign'
                : 'Pedestrian Crossing'),
        ...(node.customDelay !== null ? { customDelay: node.customDelay } : {}),
      },
    });
  });

  // Draw edges
  graph.nodes.forEach((entry) => {
    const u = entry.node;
    entry.edges.forEach((edge) => {
      const vEntry = graph.nodes.get(edge.target);
      if (!vEntry) return;
      const v = vEntry.node;

      lineFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [u.lng, u.lat],
            [v.lng, v.lat],
          ],
        },
        properties: {
          name: edge.name,
          highway: edge.tags.highway,
        },
      });
    });
  });

  return {
    streets: lineFeatures,
    controls: lightFeatures,
  };
}
