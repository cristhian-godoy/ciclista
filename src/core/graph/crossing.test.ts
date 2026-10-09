import { describe, expect, it } from 'vitest';

import {
  buildCrossingSubgraph,
  classifyCrossingEdge,
  createCrossingBoundingCircleGeoJSON,
  extractCrossingClusters,
  findCrossingTurnPath,
} from './crossing';
import type { GraphEdge, GraphNode, StreetGraph } from './types';

describe('Crossing Subgraph and Turn Routing', () => {
  describe('classifyCrossingEdge', () => {
    it('classifies cycleway and bicycle street tags correctly', () => {
      expect(classifyCrossingEdge({ highway: 'cycleway' }).category).toBe('cycleway');
      expect(classifyCrossingEdge({ highway: 'residential', cyclestreet: 'yes' }).category).toBe(
        'cycleway',
      );
      expect(classifyCrossingEdge({ highway: 'tertiary', cycleway: 'lane' }).category).toBe(
        'cycleway',
      );
      expect(classifyCrossingEdge({ highway: 'path', bicycle: 'designated' }).category).toBe(
        'cycleway',
      );
    });

    it('classifies pedestrian and sidewalk tags correctly', () => {
      expect(classifyCrossingEdge({ highway: 'pedestrian' }).category).toBe('pedestrian');
      expect(classifyCrossingEdge({ highway: 'footway' }).category).toBe('pedestrian');
      expect(classifyCrossingEdge({ highway: 'steps' }).category).toBe('pedestrian');
      expect(classifyCrossingEdge({ highway: 'path', footway: 'sidewalk' }).category).toBe(
        'pedestrian',
      );
    });

    it('classifies residential, living street, and shared path tags correctly', () => {
      expect(classifyCrossingEdge({ highway: 'residential' }).category).toBe('residential');
      expect(classifyCrossingEdge({ highway: 'living_street' }).category).toBe('residential');
      expect(classifyCrossingEdge({ highway: 'path' }).category).toBe('residential');
      expect(classifyCrossingEdge({ highway: 'service' }).category).toBe('residential');
    });

    it('classifies arterial, primary, and secondary road tags correctly', () => {
      expect(classifyCrossingEdge({ highway: 'primary' }).category).toBe('arterial');
      expect(classifyCrossingEdge({ highway: 'secondary' }).category).toBe('arterial');
      expect(classifyCrossingEdge({ highway: 'tertiary' }).category).toBe('arterial');
      expect(classifyCrossingEdge({ highway: 'trunk' }).category).toBe('arterial');
    });
  });

  describe('extractCrossingClusters and Bounding Circle', () => {
    const mockGraph: StreetGraph = {
      nodes: new Map([
        [
          'node-1',
          {
            node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: { highway: 'traffic_signals' } },
            edges: [{ target: 'node-2', distance: 20, tags: { highway: 'cycleway' } }],
          },
        ],
        [
          'node-2',
          {
            node: {
              id: 'node-2',
              lat: 48.1371,
              lng: 11.5751,
              tags: { highway: 'traffic_signals' },
            },
            edges: [{ target: 'node-3', distance: 100, tags: { highway: 'residential' } }],
          },
        ],
        [
          'node-3',
          {
            node: { id: 'node-3', lat: 48.145, lng: 11.585, tags: { highway: 'stop' } },
            edges: [],
          },
        ],
      ]),
    };

    it('clusters control nodes within 35 meters and calculates radius >= 35', () => {
      const clusters = extractCrossingClusters(mockGraph);
      expect(clusters).toHaveLength(2);

      const cluster1 = clusters.find((c) => c.nodeIds.includes('node-1'));
      expect(cluster1).toBeDefined();
      expect(cluster1?.nodeIds).toEqual(['node-1', 'node-2']);
      expect(cluster1?.controlType).toBe('signal');
      expect(cluster1?.radiusMeters).toBeGreaterThanOrEqual(35);

      const cluster2 = clusters.find((c) => c.nodeIds.includes('node-3'));
      expect(cluster2).toBeDefined();
      expect(cluster2?.nodeIds).toEqual(['node-3']);
      expect(cluster2?.controlType).toBe('stop');
      expect(cluster2?.radiusMeters).toBe(35);
    });

    it('creates valid circular GeoJSON polygon features', () => {
      const clusters = extractCrossingClusters(mockGraph);
      const feature = createCrossingBoundingCircleGeoJSON(clusters[0], 16);
      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('Polygon');
      expect(feature.geometry.coordinates[0]).toHaveLength(17);
      expect(feature.properties.radiusMeters).toBeGreaterThanOrEqual(35);
    });
  });

  describe('buildCrossingSubgraph and mini A* pathfinding', () => {
    // Construct a 4-way crossing graph with approach and departure arms:
    // West (W) -> Center (C) -> East (E)
    // South (S) -> Center (C) -> North (N)
    // Diagonal cycleway link from S to E via Waypoint (P)
    const crossingGraph: StreetGraph = {
      nodes: new Map<string, { node: GraphNode; edges: GraphEdge[] }>([
        [
          'C',
          {
            node: { id: 'C', lat: 48.137, lng: 11.575, tags: { highway: 'traffic_signals' } },
            edges: [
              { target: 'E', distance: 20, tags: { highway: 'primary' } },
              { target: 'N', distance: 20, tags: { highway: 'cycleway' } },
            ],
          },
        ],
        [
          'W',
          {
            node: { id: 'W', lat: 48.137, lng: 11.5747, tags: {} },
            edges: [{ target: 'C', distance: 20, tags: { highway: 'primary' } }],
          },
        ],
        [
          'S',
          {
            node: { id: 'S', lat: 48.1368, lng: 11.575, tags: {} },
            edges: [
              { target: 'C', distance: 20, tags: { highway: 'secondary' } },
              { target: 'P', distance: 15, tags: { highway: 'cycleway' } },
            ],
          },
        ],
        [
          'P',
          {
            node: { id: 'P', lat: 48.1368, lng: 11.5752, tags: {} },
            edges: [{ target: 'E', distance: 15, tags: { highway: 'cycleway' } }],
          },
        ],
        [
          'E',
          {
            node: { id: 'E', lat: 48.137, lng: 11.5753, tags: {} },
            edges: [],
          },
        ],
        [
          'N',
          {
            node: { id: 'N', lat: 48.1372, lng: 11.575, tags: {} },
            edges: [],
          },
        ],
      ]),
    };

    const cluster = {
      id: 'crossing-C',
      lat: 48.137,
      lng: 11.575,
      nodeIds: ['C'],
      controlType: 'signal' as const,
      radiusMeters: 40,
    };

    it('extracts crossing subgraph and classifies semantic edges', () => {
      const subgraph = buildCrossingSubgraph(crossingGraph, cluster);
      expect(subgraph.nodes.has('C')).toBe(true);
      expect(subgraph.nodes.has('W')).toBe(true);
      expect(subgraph.nodes.has('S')).toBe(true);
      expect(subgraph.nodes.has('E')).toBe(true);
      expect(subgraph.nodes.has('N')).toBe(true);

      const cyclewayEdge = subgraph.edges.find((e) => e.sourceId === 'C' && e.targetId === 'N');
      expect(cyclewayEdge?.category).toBe('cycleway');
      expect(cyclewayEdge?.color).toBe('#10b981');

      const arterialEdge = subgraph.edges.find((e) => e.sourceId === 'C' && e.targetId === 'E');
      expect(arterialEdge?.category).toBe('arterial');
      expect(arterialEdge?.color).toBe('#ef4444');
    });

    it('finds direct crossing path from W to E via C', () => {
      const subgraph = buildCrossingSubgraph(crossingGraph, cluster);
      const path = findCrossingTurnPath(subgraph, 'W', 'E');
      expect(path).toEqual(['W', 'C', 'E']);
    });

    it('routes through intermediate pinned waypoint when specified', () => {
      const subgraph = buildCrossingSubgraph(crossingGraph, cluster);
      // From S to E without waypoint: routes via C (distance: 20 + 20 = 40) or P (15 + 15 = 30)
      // When explicitly pinning waypoint P:
      const pathWithWaypoint = findCrossingTurnPath(subgraph, 'S', 'E', ['P']);
      expect(pathWithWaypoint).toEqual(['S', 'P', 'E']);

      // When explicitly pinning waypoint C:
      const pathViaC = findCrossingTurnPath(subgraph, 'S', 'E', ['C']);
      expect(pathViaC).toEqual(['S', 'C', 'E']);
    });

    it('returns null when destination is unreachable', () => {
      const subgraph = buildCrossingSubgraph(crossingGraph, cluster);
      // E has no outgoing edges, so routing from E to W is unreachable
      const path = findCrossingTurnPath(subgraph, 'E', 'W');
      expect(path).toBeNull();
    });
  });
});
