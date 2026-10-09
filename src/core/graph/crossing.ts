import { haversineDistance } from '../common/geo';
import type { GeoJSONFeature } from './geojson';
import type { StreetGraph } from './types';

/**
 * Semantic classifications for crossing edges highlighted in edit mode.
 */
export type CrossingEdgeCategory = 'cycleway' | 'residential' | 'pedestrian' | 'arterial';

/**
 * Color and label configuration details for semantic crossing edge categories.
 */
export interface CrossingSemanticClassification {
  category: CrossingEdgeCategory;
  color: string;
  label: string;
}

/**
 * Design system tokens and semantic color definitions for crossing edges.
 */
export const CROSSING_CATEGORY_CONFIG: Record<
  CrossingEdgeCategory,
  { color: string; label: string; cssVar: string }
> = {
  cycleway: {
    color: '#10b981',
    label: 'Cycleway / Bicycle Street',
    cssVar: 'var(--ciclista-color-crossing-cycleway)',
  },
  residential: {
    color: '#3b82f6',
    label: 'Residential / Living Street / Shared Path',
    cssVar: 'var(--ciclista-color-crossing-residential)',
  },
  pedestrian: {
    color: '#8b5cf6',
    label: 'Pedestrian zone / Sidewalk / Footway',
    cssVar: 'var(--ciclista-color-crossing-pedestrian)',
  },
  arterial: {
    color: '#ef4444',
    label: 'Arterial / Primary / Secondary road',
    cssVar: 'var(--ciclista-color-crossing-arterial)',
  },
};

/**
 * Classifies an OSM highway edge into one of four semantic crossing categories:
 * cycleway, residential, pedestrian, or arterial.
 *
 * @param tags - OSM key-value tags for the road edge.
 * @returns Classification containing category identifier, hex color, and human-readable label.
 */
export function classifyCrossingEdge(tags: Record<string, string>): CrossingSemanticClassification {
  const highway = tags.highway || '';

  // 1. Cycleway / Bicycle Street
  if (
    highway === 'cycleway' ||
    tags.cyclestreet === 'yes' ||
    tags.bicycle_road === 'yes' ||
    tags.cycleway === 'lane' ||
    tags.cycleway === 'track' ||
    tags['cycleway:right'] === 'lane' ||
    tags['cycleway:left'] === 'lane' ||
    tags.bicycle === 'designated'
  ) {
    return {
      category: 'cycleway',
      color: CROSSING_CATEGORY_CONFIG.cycleway.color,
      label: CROSSING_CATEGORY_CONFIG.cycleway.label,
    };
  }

  // 2. Pedestrian zone / Sidewalk / Footway
  if (
    highway === 'pedestrian' ||
    highway === 'footway' ||
    highway === 'steps' ||
    tags.footway === 'sidewalk' ||
    tags.footway === 'crossing'
  ) {
    return {
      category: 'pedestrian',
      color: CROSSING_CATEGORY_CONFIG.pedestrian.color,
      label: CROSSING_CATEGORY_CONFIG.pedestrian.label,
    };
  }

  // 3. Residential / Living Street / Shared Path
  if (
    highway === 'residential' ||
    highway === 'living_street' ||
    highway === 'path' ||
    highway === 'service' ||
    highway === 'track' ||
    highway === 'unclassified'
  ) {
    return {
      category: 'residential',
      color: CROSSING_CATEGORY_CONFIG.residential.color,
      label: CROSSING_CATEGORY_CONFIG.residential.label,
    };
  }

  // 4. Arterial / Primary / Secondary / Tertiary road
  return {
    category: 'arterial',
    color: CROSSING_CATEGORY_CONFIG.arterial.color,
    label: CROSSING_CATEGORY_CONFIG.arterial.label,
  };
}

/**
 * Data structure representing a clustered intersection or crossing.
 */
export interface CrossingCluster {
  id: string;
  lat: number;
  lng: number;
  nodeIds: string[];
  controlType: 'signal' | 'yield' | 'stop' | 'crossing';
  radiusMeters: number;
}

/**
 * Calculates Euclidean distance in meters between two coordinates.
 * Using Munich cosine latitude projection (~0.67) for high-performance spatial clustering.
 */
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  const cosLat = 0.67;
  return Math.sqrt(dLat * dLat + dLng * cosLat * (dLng * cosLat)) * 111000;
}

/**
 * Extracts all crossing clusters from the street graph using spatial hashing and computes
 * dynamic cluster bounding radii.
 *
 * @param graph - Street network graph.
 * @param customNodeDelays - Map of node IDs with custom delay overrides.
 * @param showMinorControls - Whether minor controls (yield, stop, pedestrian) are enabled.
 * @returns Array of clustered crossings with calculated centroids and radii.
 */
export function extractCrossingClusters(
  graph: StreetGraph,
  customNodeDelays?: Map<string, number>,
  showMinorControls = true,
): CrossingCluster[] {
  const controlNodes: {
    id: string;
    lat: number;
    lng: number;
    controlType: 'signal' | 'yield' | 'stop' | 'crossing';
  }[] = [];

  graph.nodes.forEach((entry, sourceId) => {
    const u = entry.node;
    const tags = u.tags || {};
    let controlType: 'signal' | 'yield' | 'stop' | 'crossing' | null = null;

    if (
      tags.highway === 'traffic_signals' ||
      tags.crossing === 'traffic_signals' ||
      tags.crossing === 'controlled'
    ) {
      controlType = 'signal';
    } else if (tags.highway === 'stop') {
      controlType = 'stop';
    } else if (tags.highway === 'give_way' || tags.highway === 'yield') {
      controlType = 'yield';
    } else if (tags.crossing === 'zebra' || tags.crossing === 'marked') {
      controlType = 'crossing';
    }

    if (controlType) {
      const hasOverride = customNodeDelays?.has(sourceId) ?? false;
      if (controlType !== 'signal' && !showMinorControls && !hasOverride) {
        return;
      }

      controlNodes.push({
        id: sourceId,
        lat: u.lat,
        lng: u.lng,
        controlType,
      });
    }
  });

  const visited = new Set<string>();
  const clusters: CrossingCluster[] = [];
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

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const cell = grid.get(`${r + dr},${c + dc}`);
          if (!cell) continue;
          for (const other of cell) {
            if (visited.has(other.id)) continue;
            if (getDistanceMeters(current.lat, current.lng, other.lat, other.lng) <= 35) {
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

    let clusterControlType: 'signal' | 'yield' | 'stop' | 'crossing' = 'crossing';
    const types = clusterNodes.map((n) => n.controlType);
    if (types.includes('signal')) {
      clusterControlType = 'signal';
    } else if (types.includes('stop')) {
      clusterControlType = 'stop';
    } else if (types.includes('yield')) {
      clusterControlType = 'yield';
    }

    // Dynamic bounding circle radius = max(35, max_distance_to_nodes + 10)
    let maxDistanceToNodes = 0;
    for (const n of clusterNodes) {
      const dist = haversineDistance(avgLat, avgLng, n.lat, n.lng);
      if (dist > maxDistanceToNodes) {
        maxDistanceToNodes = dist;
      }
    }
    const radiusMeters = Math.max(35, maxDistanceToNodes + 10);

    clusters.push({
      id: crossingId,
      lat: avgLat,
      lng: avgLng,
      nodeIds: clusterNodes.map((n) => n.id),
      controlType: clusterControlType,
      radiusMeters,
    });
  }

  return clusters;
}

/**
 * Creates a GeoJSON Polygon feature representing the circular bounding area of a crossing.
 *
 * @param cluster - The crossing cluster with centroid coordinates and radius.
 * @param points - Number of vertices in the circle polygon approximation (default 64).
 * @returns GeoJSON Polygon feature.
 */
export function createCrossingBoundingCircleGeoJSON(
  cluster: CrossingCluster,
  points = 64,
): GeoJSONFeature {
  const coords: number[][] = [];
  const km = cluster.radiusMeters / 1000;
  const distanceX = km / (111.32 * Math.cos((cluster.lat * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([cluster.lng + x, cluster.lat + y]);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: {
      crossingId: cluster.id,
      radiusMeters: cluster.radiusMeters,
      controlType: cluster.controlType,
    },
  };
}

/**
 * Represents a single edge inside the crossing subgraph with semantic attributes.
 */
export interface CrossingSubgraphEdge {
  edgeId: string;
  sourceId: string;
  targetId: string;
  distance: number;
  highway: string;
  tags: Record<string, string>;
  category: CrossingEdgeCategory;
  color: string;
  label: string;
}

/**
 * Represents a node inside the crossing subgraph.
 */
export interface CrossingSubgraphNode {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
  isClusterNode: boolean;
}

/**
 * Encapsulates the subgraph of nodes and directed edges surrounding a crossing cluster.
 */
export interface CrossingSubgraph {
  crossingId: string;
  cluster: CrossingCluster;
  nodes: Map<string, CrossingSubgraphNode>;
  edges: CrossingSubgraphEdge[];
  adjacency: Map<string, Array<{ targetId: string; edge: CrossingSubgraphEdge }>>;
}

/**
 * Builds the crossing subgraph by extracting all nodes and edges within the crossing cluster boundary
 * or directly adjacent to the cluster nodes.
 *
 * @param graph - The full street network graph.
 * @param cluster - The crossing cluster around which to extract the subgraph.
 * @returns The isolated crossing subgraph with classified semantic edges and adjacency mapping.
 */
export function buildCrossingSubgraph(
  graph: StreetGraph,
  cluster: CrossingCluster,
): CrossingSubgraph {
  const clusterNodeSet = new Set(cluster.nodeIds);
  const subgraphNodes = new Map<string, CrossingSubgraphNode>();
  const subgraphEdges: CrossingSubgraphEdge[] = [];
  const adjacency = new Map<string, Array<{ targetId: string; edge: CrossingSubgraphEdge }>>();

  // 1. Identify all candidate nodes: cluster nodes, directly connected nodes, or nodes within bounding circle
  for (const nodeId of cluster.nodeIds) {
    const entry = graph.nodes.get(nodeId);
    if (entry) {
      subgraphNodes.set(nodeId, {
        id: nodeId,
        lat: entry.node.lat,
        lng: entry.node.lng,
        tags: entry.node.tags || {},
        isClusterNode: true,
      });

      // Include outgoing neighbor nodes
      for (const edge of entry.edges) {
        if (!subgraphNodes.has(edge.target)) {
          const targetEntry = graph.nodes.get(edge.target);
          if (targetEntry) {
            subgraphNodes.set(edge.target, {
              id: edge.target,
              lat: targetEntry.node.lat,
              lng: targetEntry.node.lng,
              tags: targetEntry.node.tags || {},
              isClusterNode: clusterNodeSet.has(edge.target),
            });
          }
        }
      }
    }
  }

  // Include incoming neighbor nodes and nodes within radius
  graph.nodes.forEach((entry, sourceId) => {
    const u = entry.node;
    const distToCentroid = haversineDistance(cluster.lat, cluster.lng, u.lat, u.lng);

    if (distToCentroid <= cluster.radiusMeters) {
      if (!subgraphNodes.has(sourceId)) {
        subgraphNodes.set(sourceId, {
          id: sourceId,
          lat: u.lat,
          lng: u.lng,
          tags: u.tags || {},
          isClusterNode: clusterNodeSet.has(sourceId),
        });
      }
    }

    // Check if entry connects into a cluster node
    for (const edge of entry.edges) {
      if (clusterNodeSet.has(edge.target) && !subgraphNodes.has(sourceId)) {
        subgraphNodes.set(sourceId, {
          id: sourceId,
          lat: u.lat,
          lng: u.lng,
          tags: u.tags || {},
          isClusterNode: clusterNodeSet.has(sourceId),
        });
      }
    }
  });

  // 2. Collect all directed edges between subgraph nodes
  subgraphNodes.forEach((_node, sourceId) => {
    const entry = graph.nodes.get(sourceId);
    if (!entry) return;

    for (const edge of entry.edges) {
      if (subgraphNodes.has(edge.target)) {
        const classification = classifyCrossingEdge(edge.tags || {});
        const subEdge: CrossingSubgraphEdge = {
          edgeId: `${sourceId}->${edge.target}`,
          sourceId,
          targetId: edge.target,
          distance: edge.distance,
          highway: edge.tags?.highway || '',
          tags: edge.tags || {},
          category: classification.category,
          color: classification.color,
          label: classification.label,
        };

        subgraphEdges.push(subEdge);

        let adjList = adjacency.get(sourceId);
        if (!adjList) {
          adjList = [];
          adjacency.set(sourceId, adjList);
        }
        adjList.push({ targetId: edge.target, edge: subEdge });
      }
    }
  });

  return {
    crossingId: cluster.id,
    cluster,
    nodes: subgraphNodes,
    edges: subgraphEdges,
    adjacency,
  };
}

/**
 * Internal single-leg A* pathfinder on the crossing subgraph.
 */
function findLegPath(subgraph: CrossingSubgraph, fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId];
  const targetNode = subgraph.nodes.get(toId);
  if (!targetNode || !subgraph.nodes.has(fromId)) return null;

  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const visited = new Set<string>();

  // Priority queue item: { id: string; fScore: number }
  const queue: Array<{ id: string; fScore: number }> = [];

  distances.set(fromId, 0);
  const startNode = subgraph.nodes.get(fromId)!;
  const initialH = haversineDistance(startNode.lat, startNode.lng, targetNode.lat, targetNode.lng);
  queue.push({ id: fromId, fScore: initialH });

  while (queue.length > 0) {
    queue.sort((a, b) => a.fScore - b.fScore);
    const { id: currentId } = queue.shift()!;

    if (currentId === toId) {
      // Reconstruct path
      const path: string[] = [];
      let curr: string | undefined = toId;
      while (curr !== undefined) {
        path.unshift(curr);
        curr = previous.get(curr);
      }
      return path;
    }

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentDist = distances.get(currentId)!;
    const neighbors = subgraph.adjacency.get(currentId) || [];

    for (const { targetId: neighborId, edge } of neighbors) {
      if (visited.has(neighborId)) continue;

      const alt = currentDist + edge.distance;
      const prevDist = distances.get(neighborId) ?? Infinity;

      if (alt < prevDist) {
        distances.set(neighborId, alt);
        previous.set(neighborId, currentId);

        const nNode = subgraph.nodes.get(neighborId);
        const h = nNode
          ? haversineDistance(nNode.lat, nNode.lng, targetNode.lat, targetNode.lng)
          : 0;

        queue.push({ id: neighborId, fScore: alt + h });
      }
    }
  }

  return null;
}

/**
 * Runs a mini A* search across the crossing subgraph to find a turn path between
 * a start node and an end node, routing sequentially through any pinned intermediate waypoints.
 *
 * @param subgraph - The crossing subgraph.
 * @param fromNodeId - Starting node identifier.
 * @param toNodeId - Ending node identifier.
 * @param waypointNodeIds - Optional list of ordered intermediate waypoint node IDs.
 * @returns Array of node IDs forming the complete turn path, or null if unreachable.
 */
export function findCrossingTurnPath(
  subgraph: CrossingSubgraph,
  fromNodeId: string,
  toNodeId: string,
  waypointNodeIds: string[] = [],
): string[] | null {
  const waypoints = [fromNodeId, ...waypointNodeIds, toNodeId];
  const fullPath: string[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    const leg = findLegPath(subgraph, start, end);
    if (!leg) return null;

    if (i === 0) {
      fullPath.push(...leg);
    } else {
      // Avoid duplicate joining node
      fullPath.push(...leg.slice(1));
    }
  }

  return fullPath;
}
