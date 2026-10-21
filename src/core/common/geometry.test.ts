import { describe, expect, it } from 'vitest';

import type { StreetGraph } from '../graph/types';
import {
  createGeoJSONCircle,
  findEdgesWithinRadius,
  findNearestEdge,
  findNearestNode,
  getProjectionT,
  projectPointOnSegment,
} from './geometry';

function createMockGraph(): StreetGraph {
  const nodes = new Map();

  nodes.set('node-1', {
    node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: {} },
    edges: [
      {
        target: 'node-2',
        distance: 200,
        name: 'Main Street',
        speedLimit: 50,
        tags: { highway: 'primary' },
      },
    ],
  });

  nodes.set('node-2', {
    node: { id: 'node-2', lat: 48.139, lng: 11.575, tags: {} },
    edges: [
      {
        target: 'node-1',
        distance: 200,
        name: 'Main Street',
        speedLimit: 50,
        tags: { highway: 'primary' },
      },
      {
        target: 'node-3',
        distance: 300,
        name: 'Side Street',
        speedLimit: 30,
        tags: { highway: 'residential' },
      },
    ],
  });

  nodes.set('node-3', {
    node: { id: 'node-3', lat: 48.139, lng: 11.58, tags: {} },
    edges: [],
  });

  return { nodes };
}

describe('geometry utilities', () => {
  describe('findNearestNode', () => {
    it('returns null for empty graph', () => {
      const graph: StreetGraph = { nodes: new Map() };
      expect(findNearestNode(graph, { lat: 48.137, lng: 11.575 })).toBeNull();
    });

    it('finds closest node among graph entries', () => {
      const graph = createMockGraph();
      const nearest = findNearestNode(graph, { lat: 48.1371, lng: 11.5751 });
      expect(nearest).toBe('node-1');

      const nearest2 = findNearestNode(graph, { lat: 48.1391, lng: 11.5799 });
      expect(nearest2).toBe('node-3');
    });
  });

  describe('projectPointOnSegment', () => {
    const a = { lat: 48.0, lng: 11.0 };
    const b = { lat: 48.0, lng: 12.0 };

    it('projects midpoint perpendicularly', () => {
      const p = { lat: 48.01, lng: 11.5 };
      const proj = projectPointOnSegment(p, a, b);
      expect(proj.lat).toBeCloseTo(48.0, 5);
      expect(proj.lng).toBeCloseTo(11.5, 5);
    });

    it('clamps to endpoint a when projection is before start', () => {
      const p = { lat: 48.01, lng: 10.5 };
      const proj = projectPointOnSegment(p, a, b);
      expect(proj.lat).toBeCloseTo(a.lat, 5);
      expect(proj.lng).toBeCloseTo(a.lng, 5);
    });

    it('clamps to endpoint b when projection is beyond end', () => {
      const p = { lat: 48.01, lng: 12.5 };
      const proj = projectPointOnSegment(p, a, b);
      expect(proj.lat).toBeCloseTo(b.lat, 5);
      expect(proj.lng).toBeCloseTo(b.lng, 5);
    });

    it('handles zero-length segment gracefully', () => {
      const proj = projectPointOnSegment({ lat: 48.5, lng: 11.5 }, a, a);
      expect(proj.lat).toBe(a.lat);
      expect(proj.lng).toBe(a.lng);
    });
  });

  describe('getProjectionT', () => {
    const a = { lat: 48.0, lng: 11.0 };
    const b = { lat: 48.0, lng: 12.0 };

    it('returns 0 at start point and 1 at end point', () => {
      expect(getProjectionT(a, a, b)).toBeCloseTo(0, 5);
      expect(getProjectionT(b, a, b)).toBeCloseTo(1, 5);
    });

    it('returns ~0.5 at midpoint', () => {
      const mid = { lat: 48.0, lng: 11.5 };
      expect(getProjectionT(mid, a, b)).toBeCloseTo(0.5, 3);
    });

    it('clamps t to 0 for points before segment start', () => {
      const before = { lat: 48.0, lng: 10.0 };
      expect(getProjectionT(before, a, b)).toBe(0);
    });

    it('clamps t to 1 for points past segment end', () => {
      const after = { lat: 48.0, lng: 13.0 };
      expect(getProjectionT(after, a, b)).toBe(1);
    });

    it('returns 0 for zero-length segments', () => {
      expect(getProjectionT({ lat: 48.0, lng: 11.5 }, a, a)).toBe(0);
    });
  });

  describe('findNearestEdge', () => {
    it('returns null on graph without edges', () => {
      const graph: StreetGraph = {
        nodes: new Map([
          ['node-1', { node: { id: 'node-1', lat: 48.0, lng: 11.0, tags: {} }, edges: [] }],
        ]),
      };
      expect(findNearestEdge(graph, { lat: 48.0, lng: 11.0 })).toBeNull();
    });

    it('locates nearest directed edge reference', () => {
      const graph = createMockGraph();
      const edgeRef = findNearestEdge(graph, { lat: 48.138, lng: 11.5752 });
      expect(edgeRef).not.toBeNull();
      expect(['node-1', 'node-2']).toContain(edgeRef?.uId);
      expect(['node-1', 'node-2']).toContain(edgeRef?.vId);
      expect(edgeRef?.distance).toBeLessThan(50);
    });
  });

  describe('findEdgesWithinRadius', () => {
    it('returns empty array when radius is negative', () => {
      const graph = createMockGraph();
      expect(findEdgesWithinRadius(graph, { lat: 48.138, lng: 11.575 }, -10)).toEqual([]);
    });

    it('identifies edges within specified radius meters', () => {
      const graph = createMockGraph();
      const edges = findEdgesWithinRadius(graph, { lat: 48.138, lng: 11.575 }, 50);
      expect(edges).toContain('node-1->node-2');
      expect(edges).toContain('node-2->node-1');
      expect(edges).not.toContain('node-2->node-3');
    });
  });

  describe('createGeoJSONCircle', () => {
    it('returns empty polygon coordinates when radius is 0 or negative', () => {
      const circle = createGeoJSONCircle({ lat: 48.0, lng: 11.0 }, 0);
      expect(circle.coordinates).toEqual([[]]);
    });

    it('constructs a closed polygon loop matching point count', () => {
      const points = 32;
      const circle = createGeoJSONCircle({ lat: 48.137, lng: 11.575 }, 500, points);
      expect(circle.type).toBe('Polygon');
      const ring = circle.coordinates[0];
      expect(ring).toBeDefined();
      if (!ring) return;
      expect(ring.length).toBe(points + 1);
      const first = ring[0];
      const last = ring[ring.length - 1];
      expect(first).toBeDefined();
      expect(last).toBeDefined();
      if (!first || !last) return;
      expect(first[0]).toBeCloseTo(last[0], 8);
      expect(first[1]).toBeCloseTo(last[1], 8);
    });
  });
});
