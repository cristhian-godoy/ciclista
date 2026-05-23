import type { IRouter, StreetGraph, Coordinate, CostFunction, LocalOverrides, RouteResult } from '../types';
import { haversineDistance } from '../graph/parser';

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
    overrides: LocalOverrides
  ): RouteResult | null {
    // 1. Snap start/end coords to nearest nodes
    const startNodeId = findNearestNode(graph, start);
    const endNodeId = findNearestNode(graph, end);

    if (!startNodeId || !endNodeId) {
      console.error('Could not find start or end nodes in graph');
      return null;
    }

    if (startNodeId === endNodeId) {
      const singleNode = graph.nodes.get(startNodeId)!.node;
      return {
        pathNodeIds: [startNodeId],
        coordinates: [{ lat: singleNode.lat, lng: singleNode.lng }],
        totalDurationSeconds: 0,
        totalDistanceMeters: 0,
        streets: [],
        trafficSignalsCount: 0,
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
            const p = parentEntry.node;
            const c = currentEntry.node;
            const n = neighborEntry.node;

            const cosLat = Math.cos(c.lat * Math.PI / 180);
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
                edgeCost += 30; // 30s penalty
              }
              // Normal turn (angle between 45 and 135 deg)
              else if (cosTheta >= -0.7 && cosTheta <= 0.7) {
                edgeCost += 3; // 3s penalty
              }
            }
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
    const streetsSet = new Set<string>();
    const edgesDetails: NonNullable<RouteResult['edges']> = [];

    for (let i = 0; i < pathNodeIds.length; i++) {
      const nodeId = pathNodeIds[i];
      const entry = graph.nodes.get(nodeId)!;
      coordinates.push({ lat: entry.node.lat, lng: entry.node.lng });

      // Count traffic signals (nodes with specific highway/crossing tags)
      const tags = entry.node.tags || {};
      if (
        tags.highway === 'traffic_signals' ||
        tags.crossing === 'traffic_signals' ||
        tags.crossing === 'controlled'
      ) {
        trafficSignalsCount++;
      }

      // Add edge distance and street names
      if (i < pathNodeIds.length - 1) {
        const nextNodeId = pathNodeIds[i + 1];
        const edge = entry.edges.find(e => e.target === nextNodeId);
        if (edge) {
          totalDistanceMeters += edge.distance;
          if (edge.name) {
            streetsSet.add(edge.name);
          }
          const edgeCost = costFn(nodeId, edge, nextNodeId, overrides, graph);

          let turnPenalty = 0;
          if (i > 0) {
            const parentId = pathNodeIds[i - 1];
            const parentEntry = graph.nodes.get(parentId);
            const nextEntry = graph.nodes.get(nextNodeId);
            if (parentEntry && nextEntry) {
              const p = parentEntry.node;
              const c = entry.node;
              const n = nextEntry.node;

              const cosLat = Math.cos(c.lat * Math.PI / 180);
              const v1x = (c.lng - p.lng) * cosLat;
              const v1y = c.lat - p.lat;
              const v2x = (n.lng - c.lng) * cosLat;
              const v2y = n.lat - c.lat;

              const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
              const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

              if (len1 > 1e-7 && len2 > 1e-7) {
                const dot = v1x * v2x + v1y * v2y;
                const cosTheta = dot / (len1 * len2);
                if (cosTheta < -0.7) {
                  turnPenalty = 30; // 30s U-turn penalty
                } else if (cosTheta >= -0.7 && cosTheta <= 0.7) {
                  turnPenalty = 3;  // 3s normal turn penalty
                }
              }
            }
          }

          edgesDetails.push({
            sourceId: nodeId,
            targetId: nextNodeId,
            name: edge.name || 'Unnamed Street',
            distance: edge.distance,
            highway: edge.tags.highway || 'unknown',
            tags: edge.tags,
            cost: edgeCost + turnPenalty,
          });
        }
      }
    }

    return {
      pathNodeIds,
      coordinates,
      // Total duration represents the shortest cost found by Dijkstra (in seconds)
      totalDurationSeconds: distances.get(endNodeId) || 0,
      totalDistanceMeters,
      streets: Array.from(streetsSet),
      trafficSignalsCount,
      edges: edgesDetails,
    };
  }
}
