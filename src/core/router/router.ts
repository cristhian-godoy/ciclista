import type { StreetGraph, GraphEdge, GraphNode } from '../graph/types';
import type { Coordinate } from '../common/types';
import type { LocalOverrides } from '../storage/types';
import type { IRouter, CostFunction, RouteResult } from './types';
import { haversineDistance } from '../graph/parser';
import { mapOSMToSignAndRoad, mapOSMNodeToControl, hasCycleway } from './rules';
import { calculateDisplayCost } from './cost';

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
      return 30; // 30s penalty
    }
    // Normal turn (angle between 45 and 135 deg)
    else if (cosTheta >= -0.7 && cosTheta <= 0.7) {
      return 3; // 3s penalty
    }
  }
  return 0;
}

/**
 * Classifies an OSM highway tag into one of four categories for route analytics.
 */
export function getRoadTypeCategory(
  highway: string,
  tags: Record<string, string>,
): 'cycleway' | 'residential' | 'primary' | 'other' {
  const hasCyclewayTag = hasCycleway(tags);
  const hasBicycleDesignated = tags.bicycle === 'designated' || tags.bicycle === 'yes';

  if (
    highway === 'cycleway' ||
    hasCyclewayTag ||
    hasBicycleDesignated ||
    tags.bicycle_road === 'yes' ||
    tags.cyclestreet === 'yes'
  ) {
    return 'cycleway';
  }

  if (
    ['residential', 'living_street', 'tertiary', 'tertiary_link', 'unclassified'].includes(highway)
  )
    return 'residential';
  if (['primary', 'primary_link', 'secondary', 'secondary_link'].includes(highway))
    return 'primary';
  return 'other';
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

interface EdgeRef {
  uId: string;
  vId: string;
  distance: number;
  projected: Coordinate;
  edge: GraphEdge;
}

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
 * A standard Min-Heap Priority Queue for Dijkstra performance.
 */
class MinHeap<T> {
  private heap: { element: T; priority: number }[] = [];

  push(element: T, priority: number) {
    this.heap.push({ element, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | null {
    if (this.heap.length === 0) return null;
    const top = this.heap[0].element;
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number) {
    const node = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (node.priority >= parent.priority) break;
      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = node;
  }

  private sinkDown(index: number) {
    const length = this.heap.length;
    const node = this.heap[index];
    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swapIndex = -1;

      if (leftChildIndex < length) {
        if (this.heap[leftChildIndex].priority < node.priority) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        const rightChild = this.heap[rightChildIndex];
        const leftChild = this.heap[leftChildIndex];
        if (
          (swapIndex === -1 && rightChild.priority < node.priority) ||
          (swapIndex !== -1 && rightChild.priority < leftChild.priority)
        ) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === -1) break;
      this.heap[index] = this.heap[swapIndex];
      index = swapIndex;
    }
    this.heap[index] = node;
  }
}

export class DijkstraRouter implements IRouter {
  findRoute(
    graph: StreetGraph,
    start: Coordinate,
    end: Coordinate,
    costFn: CostFunction,
    overrides: LocalOverrides,
  ): RouteResult | null {
    const startEdgeRef = findNearestEdge(graph, start);
    const endEdgeRef = findNearestEdge(graph, end);

    // If we can't find nearest edges (e.g. empty/invalid graph), fall back to node snapping
    if (!startEdgeRef || !endEdgeRef) {
      return this.findRouteNodeFallback(graph, start, end, costFn, overrides);
    }

    const startProj = startEdgeRef.projected;
    const startUId = startEdgeRef.uId;
    const startVId = startEdgeRef.vId;
    const startEdge = startEdgeRef.edge;

    const endProj = endEdgeRef.projected;
    const endUId = endEdgeRef.uId;
    const endVId = endEdgeRef.vId;
    const endEdge = endEdgeRef.edge;

    const startU = graph.nodes.get(startUId);
    const startV = graph.nodes.get(startVId);
    const endU = graph.nodes.get(endUId);
    const endV = graph.nodes.get(endVId);

    if (!startU || !startV || !endU || !endV) {
      console.warn('Virtual routing reference nodes missing from graph. Falling back.');
      return this.findRouteNodeFallback(graph, start, end, costFn, overrides);
    }

    const startUNode = startU.node;
    const startVNode = startV.node;
    const endUNode = endU.node;
    const endVNode = endV.node;

    const START_VNODE_ID = 'virtual-start';
    const END_VNODE_ID = 'virtual-end';

    const virtualStartNode: GraphNode = {
      id: START_VNODE_ID,
      lat: startProj.lat,
      lng: startProj.lng,
      tags: {},
    };

    const virtualEndNode: GraphNode = {
      id: END_VNODE_ID,
      lat: endProj.lat,
      lng: endProj.lng,
      tags: {},
    };

    const backupNodes = new Map<string, GraphEdge[]>();
    const backupNodeEdges = (nodeId: string) => {
      if (backupNodes.has(nodeId)) return;
      const entry = graph.nodes.get(nodeId);
      if (entry) {
        backupNodes.set(nodeId, [...entry.edges]);
      }
    };

    try {
      // 1. Inject virtual start/end nodes
      graph.nodes.set(START_VNODE_ID, { node: virtualStartNode, edges: [] });
      graph.nodes.set(END_VNODE_ID, { node: virtualEndNode, edges: [] });

      // 2. Add outgoing edges from virtual-start
      const distToVs = haversineDistance(
        startProj.lat,
        startProj.lng,
        startVNode.lat,
        startVNode.lng,
      );
      const distToUs = haversineDistance(
        startProj.lat,
        startProj.lng,
        startUNode.lat,
        startUNode.lng,
      );

      // Edge UV_S (virtual-start -> V_s)
      graph.nodes.get(START_VNODE_ID)!.edges.push({
        target: startVId,
        distance: distToVs,
        name: startEdge.name,
        speedLimit: startEdge.speedLimit,
        tags: startEdge.tags,
      });

      // Edge VU_S (virtual-start -> U_s if bidirectional)
      const startEdgeVU = graph.nodes.get(startVId)?.edges.find((e) => e.target === startUId);
      if (startEdgeVU) {
        graph.nodes.get(START_VNODE_ID)!.edges.push({
          target: startUId,
          distance: distToUs,
          name: startEdgeVU.name,
          speedLimit: startEdgeVU.speedLimit,
          tags: startEdgeVU.tags,
        });
      }

      // 3. Add incoming edges to virtual-end
      const distUToE = haversineDistance(endUNode.lat, endUNode.lng, endProj.lat, endProj.lng);
      const distVToE = haversineDistance(endVNode.lat, endVNode.lng, endProj.lat, endProj.lng);

      backupNodeEdges(endUId);
      graph.nodes.get(endUId)!.edges.push({
        target: END_VNODE_ID,
        distance: distUToE,
        name: endEdge.name,
        speedLimit: endEdge.speedLimit,
        tags: endEdge.tags,
      });

      const endEdgeVU = graph.nodes.get(endVId)?.edges.find((e) => e.target === endUId);
      if (endEdgeVU) {
        backupNodeEdges(endVId);
        graph.nodes.get(endVId)!.edges.push({
          target: END_VNODE_ID,
          distance: distVToE,
          name: endEdgeVU.name,
          speedLimit: endEdgeVU.speedLimit,
          tags: endEdgeVU.tags,
        });
      }

      // 4. Handle same-edge direct routing
      const sameEdge =
        (startUId === endUId && startVId === endVId) ||
        (startUId === endVId && startVId === endUId);
      if (sameEdge) {
        const ts = getProjectionT(start, startUNode, startVNode);
        const te = getProjectionT(end, startUNode, startVNode);

        if (ts <= te) {
          graph.nodes.get(START_VNODE_ID)!.edges.push({
            target: END_VNODE_ID,
            distance: haversineDistance(startProj.lat, startProj.lng, endProj.lat, endProj.lng),
            name: startEdge.name,
            speedLimit: startEdge.speedLimit,
            tags: startEdge.tags,
          });
        }

        if (ts >= te && startEdgeVU) {
          graph.nodes.get(START_VNODE_ID)!.edges.push({
            target: END_VNODE_ID,
            distance: haversineDistance(startProj.lat, startProj.lng, endProj.lat, endProj.lng),
            name: startEdgeVU.name,
            speedLimit: startEdgeVU.speedLimit,
            tags: startEdgeVU.tags,
          });
        }
      }

      // 5. Setup Dijkstra data structures
      const distances = new Map<string, number>();
      const previous = new Map<string, string>();
      const visited = new Set<string>();
      const heap = new MinHeap<string>();

      distances.set(START_VNODE_ID, 0);
      heap.push(START_VNODE_ID, 0);

      // Initialize all other node distances to Infinity
      for (const nodeId of graph.nodes.keys()) {
        if (nodeId !== START_VNODE_ID) {
          distances.set(nodeId, Infinity);
        }
      }

      let destReached = false;

      // 6. Main Dijkstra search loop
      while (!heap.isEmpty()) {
        const currentId = heap.pop();
        if (!currentId) break;

        if (currentId === END_VNODE_ID) {
          destReached = true;
          break;
        }

        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const currentEntry = graph.nodes.get(currentId);
        if (!currentEntry) continue;

        const currentDist = distances.get(currentId) || 0;

        for (const edge of currentEntry.edges) {
          const neighborId = edge.target;
          if (visited.has(neighborId)) continue;

          // Calculate dynamic edge cost using injected cost function
          let edgeCost = costFn(currentId, edge, neighborId, overrides, graph);

          // Apply turn penalty (avoiding U-turns and sharp turns on routing)
          const parentId = previous.get(currentId);
          if (parentId) {
            const parentEntry = graph.nodes.get(parentId);
            const neighborEntry = graph.nodes.get(neighborId);
            if (parentEntry && neighborEntry) {
              edgeCost += calculateTurnPenalty(
                parentEntry.node,
                currentEntry.node,
                neighborEntry.node,
              );
            }
          }

          const altDist = currentDist + edgeCost;

          if (altDist < (distances.get(neighborId) || Infinity)) {
            distances.set(neighborId, altDist);
            previous.set(neighborId, currentId);
            heap.push(neighborId, altDist);
          }
        }
      }

      if (!destReached) {
        console.warn('Destination node is unreachable from source node');
        return null;
      }

      // 7. Reconstruct the path and calculate statistics
      const pathNodeIds: string[] = [];
      let current = END_VNODE_ID;
      while (current) {
        pathNodeIds.unshift(current);
        current = previous.get(current) || '';
      }

      // Build statistics
      const coordinates: Coordinate[] = [];
      let totalDistanceMeters = 0;
      let trafficSignalsCount = 0;
      let signalCount = 0;
      let yieldCount = 0;
      let crossingCount = 0;
      const roadTypeTotals: Record<string, number> = {
        cycleway: 0,
        residential: 0,
        primary: 0,
        other: 0,
      };
      const streetsSet = new Set<string>();
      const edgesDetails: NonNullable<RouteResult['edges']> = [];

      let totalDisplayCost = 0;

      for (let i = 0; i < pathNodeIds.length; i++) {
        const nodeId = pathNodeIds[i];
        const entry = graph.nodes.get(nodeId);
        if (!entry) continue;
        coordinates.push({ lat: entry.node.lat, lng: entry.node.lng });

        // Count control points using centralized node classifier
        const tags = entry.node.tags || {};
        const controlType = mapOSMNodeToControl(tags);
        if (controlType === 'signal') {
          trafficSignalsCount++;
          signalCount++;
        } else if (controlType === 'yield') {
          yieldCount++;
        } else if (controlType === 'crossing') {
          crossingCount++;
        }

        // Add edge distance and street names
        if (i < pathNodeIds.length - 1) {
          const nextNodeId = pathNodeIds[i + 1];
          const edge = entry.edges.find((e) => e.target === nextNodeId);
          if (edge) {
            totalDistanceMeters += edge.distance;
            if (edge.name) {
              streetsSet.add(edge.name);
            }
            const displayCost = calculateDisplayCost(nodeId, edge, nextNodeId, overrides, graph);

            let turnPenalty = 0;
            if (i > 0) {
              const parentId = pathNodeIds[i - 1];
              const parentEntry = graph.nodes.get(parentId);
              const nextEntry = graph.nodes.get(nextNodeId);
              if (parentEntry && nextEntry) {
                turnPenalty = calculateTurnPenalty(parentEntry.node, entry.node, nextEntry.node);
              }
            }

            totalDisplayCost += displayCost + turnPenalty;

            const cat = getRoadTypeCategory(edge.tags.highway || 'unknown', edge.tags);
            roadTypeTotals[cat] = (roadTypeTotals[cat] || 0) + edge.distance;

            const { sign: matchedSign, road: matchedRoad } = mapOSMToSignAndRoad(
              edge.tags.highway || '',
              edge.tags,
            );
            edgesDetails.push({
              sourceId: nodeId,
              targetId: nextNodeId,
              name: edge.name || 'Unnamed Street',
              distance: edge.distance,
              highway: edge.tags.highway || 'unknown',
              tags: edge.tags,
              cost: displayCost + turnPenalty,
              matchedSign,
              matchedRoad,
            });
          }
        }
      }

      // Add start/end coordinates to the path with duplicate cleaning
      const rawCoords: Coordinate[] = [start, ...coordinates, end];
      const finalCoords: Coordinate[] = [];
      for (const c of rawCoords) {
        if (finalCoords.length === 0) {
          finalCoords.push(c);
        } else {
          const last = finalCoords[finalCoords.length - 1];
          const dist2 = Math.pow(c.lat - last.lat, 2) + Math.pow(c.lng - last.lng, 2);
          if (dist2 > 1e-14) {
            finalCoords.push(c);
          }
        }
      }

      // Add out-of-network interpolation segments to stats
      const startInterpDist = haversineDistance(start.lat, start.lng, startProj.lat, startProj.lng);
      const endInterpDist = haversineDistance(end.lat, end.lng, endProj.lat, endProj.lng);

      totalDistanceMeters += startInterpDist + endInterpDist;

      const startInterpDuration = startInterpDist / 1.5;
      const endInterpDuration = endInterpDist / 1.5;
      const totalDurationSeconds = totalDisplayCost + startInterpDuration + endInterpDuration;

      return {
        pathNodeIds,
        coordinates: finalCoords,
        totalDurationSeconds,
        totalDistanceMeters,
        streets: Array.from(streetsSet),
        trafficSignalsCount,
        signalCount,
        yieldCount,
        crossingCount,
        roadTypeTotals,
        edges: edgesDetails,
      };
    } finally {
      // 8. Restore the graph to pristine state
      for (const [nodeId, originalEdges] of backupNodes.entries()) {
        const entry = graph.nodes.get(nodeId);
        if (entry) {
          entry.edges = originalEdges;
        }
      }
      graph.nodes.delete(START_VNODE_ID);
      graph.nodes.delete(END_VNODE_ID);
    }
  }

  private findRouteNodeFallback(
    graph: StreetGraph,
    start: Coordinate,
    end: Coordinate,
    costFn: CostFunction,
    overrides: LocalOverrides,
  ): RouteResult | null {
    // 1. Snap start/end coords to nearest nodes
    const startNodeId = findNearestNode(graph, start);
    const endNodeId = findNearestNode(graph, end);

    if (!startNodeId || !endNodeId) {
      console.error('Could not find start or end nodes in graph');
      return null;
    }

    if (startNodeId === endNodeId) {
      const startNodeEntry = graph.nodes.get(startNodeId);
      if (!startNodeEntry) return null;
      const singleNode = startNodeEntry.node;
      return {
        pathNodeIds: [startNodeId],
        coordinates: [{ lat: singleNode.lat, lng: singleNode.lng }],
        totalDurationSeconds: 0,
        totalDistanceMeters: 0,
        streets: [],
        trafficSignalsCount: 0,
        signalCount: 0,
        yieldCount: 0,
        crossingCount: 0,
        roadTypeTotals: {
          cycleway: 0,
          residential: 0,
          primary: 0,
          other: 0,
        },
      };
    }

    // 2. Setup Dijkstra data structures
    const distances = new Map<string, number>();
    const previous = new Map<string, string>();
    const visited = new Set<string>();
    const heap = new MinHeap<string>();

    distances.set(startNodeId, 0);
    heap.push(startNodeId, 0);

    // Initialize all other node distances to Infinity
    for (const nodeId of graph.nodes.keys()) {
      if (nodeId !== startNodeId) {
        distances.set(nodeId, Infinity);
      }
    }

    let destReached = false;

    // 3. Main Dijkstra search loop
    while (!heap.isEmpty()) {
      const currentId = heap.pop();
      if (!currentId) break;

      if (currentId === endNodeId) {
        destReached = true;
        break;
      }

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentEntry = graph.nodes.get(currentId);
      if (!currentEntry) continue;

      const currentDist = distances.get(currentId) || 0;

      for (const edge of currentEntry.edges) {
        const neighborId = edge.target;
        if (visited.has(neighborId)) continue;

        // Calculate dynamic edge cost using injected cost function
        let edgeCost = costFn(currentId, edge, neighborId, overrides, graph);

        // Apply turn penalty (avoiding U-turns and sharp turns on routing)
        const parentId = previous.get(currentId);
        if (parentId) {
          const parentEntry = graph.nodes.get(parentId);
          const neighborEntry = graph.nodes.get(neighborId);
          if (parentEntry && neighborEntry) {
            edgeCost += calculateTurnPenalty(
              parentEntry.node,
              currentEntry.node,
              neighborEntry.node,
            );
          }
        }

        const altDist = currentDist + edgeCost;

        if (altDist < (distances.get(neighborId) || Infinity)) {
          distances.set(neighborId, altDist);
          previous.set(neighborId, currentId);
          heap.push(neighborId, altDist);
        }
      }
    }

    if (!destReached) {
      console.warn('Destination node is unreachable from source node');
      return null;
    }

    // 4. Reconstruct the path and calculate statistics
    const pathNodeIds: string[] = [];
    let current = endNodeId;
    while (current) {
      pathNodeIds.unshift(current);
      current = previous.get(current) || '';
    }

    // Build statistics
    const coordinates: Coordinate[] = [];
    let totalDistanceMeters = 0;
    let trafficSignalsCount = 0;
    let signalCount = 0;
    let yieldCount = 0;
    let crossingCount = 0;
    const roadTypeTotals: Record<string, number> = {
      cycleway: 0,
      residential: 0,
      primary: 0,
      other: 0,
    };
    const streetsSet = new Set<string>();
    const edgesDetails: NonNullable<RouteResult['edges']> = [];
    let totalDisplayCost = 0;

    for (let i = 0; i < pathNodeIds.length; i++) {
      const nodeId = pathNodeIds[i];
      const entry = graph.nodes.get(nodeId);
      if (!entry) continue;
      coordinates.push({ lat: entry.node.lat, lng: entry.node.lng });

      // Count control points using centralized node classifier
      const tags = entry.node.tags || {};
      const controlType = mapOSMNodeToControl(tags);
      if (controlType === 'signal') {
        trafficSignalsCount++;
        signalCount++;
      } else if (controlType === 'yield') {
        yieldCount++;
      } else if (controlType === 'crossing') {
        crossingCount++;
      }

      // Add edge distance and street names
      if (i < pathNodeIds.length - 1) {
        const nextNodeId = pathNodeIds[i + 1];
        const edge = entry.edges.find((e) => e.target === nextNodeId);
        if (edge) {
          totalDistanceMeters += edge.distance;
          if (edge.name) {
            streetsSet.add(edge.name);
          }
          const displayCost = calculateDisplayCost(nodeId, edge, nextNodeId, overrides, graph);

          let turnPenalty = 0;
          if (i > 0) {
            const parentId = pathNodeIds[i - 1];
            const parentEntry = graph.nodes.get(parentId);
            const nextEntry = graph.nodes.get(nextNodeId);
            if (parentEntry && nextEntry) {
              turnPenalty = calculateTurnPenalty(parentEntry.node, entry.node, nextEntry.node);
            }
          }

          totalDisplayCost += displayCost + turnPenalty;

          const cat = getRoadTypeCategory(edge.tags.highway || 'unknown', edge.tags);
          roadTypeTotals[cat] = (roadTypeTotals[cat] || 0) + edge.distance;

          const { sign: matchedSign, road: matchedRoad } = mapOSMToSignAndRoad(
            edge.tags.highway || '',
            edge.tags,
          );
          edgesDetails.push({
            sourceId: nodeId,
            targetId: nextNodeId,
            name: edge.name || 'Unnamed Street',
            distance: edge.distance,
            highway: edge.tags.highway || 'unknown',
            tags: edge.tags,
            cost: displayCost + turnPenalty,
            matchedSign,
            matchedRoad,
          });
        }
      }
    }

    let finalCoords: Coordinate[] = [];
    if (coordinates.length >= 2) {
      const n0 = coordinates[0];
      const n1 = coordinates[1];
      const nk_1 = coordinates[coordinates.length - 2];
      const nk = coordinates[coordinates.length - 1];

      const projectedStart = projectPointOnSegment(start, n0, n1);
      const projectedEnd = projectPointOnSegment(end, nk_1, nk);

      const adjusted: Coordinate[] = [start, projectedStart];
      for (let i = 1; i < coordinates.length - 1; i++) {
        adjusted.push(coordinates[i]);
      }
      adjusted.push(projectedEnd);
      adjusted.push(end);

      // Clean consecutive duplicates
      for (const c of adjusted) {
        if (finalCoords.length === 0) {
          finalCoords.push(c);
        } else {
          const last = finalCoords[finalCoords.length - 1];
          const dist2 = Math.pow(c.lat - last.lat, 2) + Math.pow(c.lng - last.lng, 2);
          if (dist2 > 1e-14) {
            finalCoords.push(c);
          }
        }
      }
    } else if (coordinates.length === 1) {
      finalCoords = [start, coordinates[0], end];
    }

    return {
      pathNodeIds,
      coordinates: finalCoords,
      totalDurationSeconds: totalDisplayCost,
      totalDistanceMeters,
      streets: Array.from(streetsSet),
      trafficSignalsCount,
      signalCount,
      yieldCount,
      crossingCount,
      roadTypeTotals,
      edges: edgesDetails,
    };
  }
}
