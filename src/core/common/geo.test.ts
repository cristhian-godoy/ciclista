import { describe, expect, it, vi } from 'vitest';

import type { StreetGraph } from '../graph/types';
import { coordToChunkId, getChunkBBox, getChunksInBBox, mergeChunksToBBox } from './geo';
import { createGeoJSONCircle, findEdgesWithinRadius } from './geometry';
import { logger } from './logger';

vi.mock('./logger', () => ({
  logger: {
    warn: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('geo chunking utilities', () => {
  it('coordToChunkId should map coordinate to indices', () => {
    // Lat: 48.137, Lng: 11.575
    // With Size: 0.01
    // 48.137 / 0.01 = 4813.7 -> Floor: 4813
    // 11.575 / 0.01 = 1157.5 -> Floor: 1157
    expect(coordToChunkId(48.137, 11.575)).toBe('4813,1157');
    expect(coordToChunkId(-48.137, -11.575)).toBe('-4814,-1158');
  });

  it('getChunkBBox should return correct boundaries', () => {
    const bbox = getChunkBBox('4813,1157');
    expect(bbox).toEqual([48.13, 11.57, 48.14, 11.58]);
  });

  it('getChunksInBBox should return intersecting chunks', () => {
    const bbox: [number, number, number, number] = [48.132, 11.572, 48.145, 11.585];
    // Start Lat Idx: Floor(48.132 / 0.01) = 4813. End Lat Idx: Floor(48.145 / 0.01) = 4814.
    // Start Lng Idx: Floor(11.572 / 0.01) = 1157. End Lng Idx: Floor(11.585 / 0.01) = 1158.
    // Chunks: 4813,1157; 4813,1158; 4814,1157; 4814,1158
    const chunks = getChunksInBBox(bbox);
    expect(chunks).toHaveLength(4);
    expect(chunks).toContain('4813,1157');
    expect(chunks).toContain('4813,1158');
    expect(chunks).toContain('4814,1157');
    expect(chunks).toContain('4814,1158');
  });

  it('getChunksInBBox should abort and return empty array if safety limit exceeded', () => {
    const spy = vi.spyOn(logger, 'warn');
    const bbox: [number, number, number, number] = [48.0, 11.0, 49.0, 12.0]; // 100 * 100 = 10000 chunks
    const chunks = getChunksInBBox(bbox);
    expect(chunks).toEqual([]);
    expect(spy).toHaveBeenCalled();
  });

  it('mergeChunksToBBox should calculate containing envelope', () => {
    const chunks = ['4813,1157', '4814,1158'];
    // 4813,1157 -> [48.13, 11.57, 48.14, 11.58]
    // 4814,1158 -> [48.14, 11.58, 48.15, 11.59]
    // Envelope -> [48.13, 11.57, 48.15, 11.59]
    const merged = mergeChunksToBBox(chunks);
    expect(merged).toEqual([48.13, 11.57, 48.15, 11.59]);
  });

  it('mergeChunksToBBox with empty input should return empty bounds', () => {
    expect(mergeChunksToBBox([])).toEqual([0, 0, 0, 0]);
  });
});

describe('findEdgesWithinRadius', () => {
  const createMockGraph = (): StreetGraph => {
    const nodes = new Map();
    nodes.set('node-1', {
      node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: {} },
      edges: [
        { target: 'node-2', distance: 111, tags: {} },
        { target: 'node-3', distance: 1000, tags: {} },
      ],
    });
    nodes.set('node-2', {
      node: { id: 'node-2', lat: 48.138, lng: 11.575, tags: {} },
      edges: [{ target: 'node-1', distance: 111, tags: {} }],
    });
    nodes.set('node-3', {
      node: { id: 'node-3', lat: 48.137, lng: 11.585, tags: {} },
      edges: [{ target: 'node-1', distance: 1000, tags: {} }],
    });
    return { nodes };
  };

  it('returns empty array when radius is negative', () => {
    const graph = createMockGraph();
    const result = findEdgesWithinRadius(graph, { lat: 48.1375, lng: 11.575 }, -10);
    expect(result).toEqual([]);
  });

  it('returns empty array when graph has no nodes or edges', () => {
    const emptyGraph: StreetGraph = { nodes: new Map() };
    const result = findEdgesWithinRadius(emptyGraph, { lat: 48.1375, lng: 11.575 }, 50);
    expect(result).toEqual([]);
  });

  it('finds directed edges within radius of segment midpoint', () => {
    const graph = createMockGraph();
    // Center at midpoint between node-1 and node-2
    const center = { lat: 48.1375, lng: 11.575 };
    const result = findEdgesWithinRadius(graph, center, 30);

    expect(result).toContain('node-1->node-2');
    expect(result).toContain('node-2->node-1');
    expect(result).not.toContain('node-1->node-3');
    expect(result).not.toContain('node-3->node-1');
  });

  it('excludes edges when center is completely outside radius', () => {
    const graph = createMockGraph();
    // Far coordinate away from all edges
    const center = { lat: 48.2, lng: 11.6 };
    const result = findEdgesWithinRadius(graph, center, 50);
    expect(result).toEqual([]);
  });

  it('includes multiple edges if multiple segments pass within radius', () => {
    const graph = createMockGraph();
    // Center close to node-1 where both node-1->node-2 and node-1->node-3 connect
    const center = { lat: 48.13705, lng: 11.575 };
    const result = findEdgesWithinRadius(graph, center, 30);

    expect(result).toContain('node-1->node-2');
    expect(result).toContain('node-2->node-1');
    expect(result).toContain('node-1->node-3');
    expect(result).toContain('node-3->node-1');
  });
});

describe('createGeoJSONCircle', () => {
  it('returns empty ring when radius is zero or negative', () => {
    const zeroCircle = createGeoJSONCircle({ lat: 48.137, lng: 11.575 }, 0);
    expect(zeroCircle.type).toBe('Polygon');
    expect(zeroCircle.coordinates).toEqual([[]]);

    const negCircle = createGeoJSONCircle({ lat: 48.137, lng: 11.575 }, -10);
    expect(negCircle.coordinates).toEqual([[]]);
  });

  it('generates a closed polygon ring with the requested number of vertices', () => {
    const points = 32;
    const circle = createGeoJSONCircle({ lat: 48.137, lng: 11.575 }, 50, points);
    expect(circle.type).toBe('Polygon');
    expect(circle.coordinates).toHaveLength(1);

    const ring = circle.coordinates[0];
    // ring should have points + 1 vertices (closed ring)
    expect(ring).toHaveLength(points + 1);
    // first and last coordinates must match
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('generates vertices at approximately radius distance from center', () => {
    const center = { lat: 48.137, lng: 11.575 };
    const radiusMeters = 100;
    const circle = createGeoJSONCircle(center, radiusMeters, 16);
    const ring = circle.coordinates[0];

    // Check each vertex distance from center
    for (const [lng, lat] of ring) {
      // 1 deg lat ~= 111,000m
      const dLatM = (lat - center.lat) * 111320;
      const dLngM = (lng - center.lng) * 111320 * Math.cos((center.lat * Math.PI) / 180);
      const dist = Math.hypot(dLatM, dLngM);
      expect(dist).toBeGreaterThan(95);
      expect(dist).toBeLessThan(105);
    }
  });
});
