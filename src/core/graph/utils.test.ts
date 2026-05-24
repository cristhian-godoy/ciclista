import { describe, expect, it } from 'vitest';

import type { StreetGraph } from './types';
import { mergeGraphs } from './utils';

describe('mergeGraphs', () => {
  it('correctly merges two empty graphs', () => {
    const g1: StreetGraph = { nodes: new Map() };
    const g2: StreetGraph = { nodes: new Map() };
    const merged = mergeGraphs(g1, g2);
    expect(merged.nodes.size).toBe(0);
  });

  it('merges nodes from both graphs without overlap', () => {
    const nodeA = { id: 'A', lat: 1, lng: 1, tags: {} };
    const nodeB = { id: 'B', lat: 2, lng: 2, tags: {} };
    const g1: StreetGraph = {
      nodes: new Map([['A', { node: nodeA, edges: [] }]]),
    };
    const g2: StreetGraph = {
      nodes: new Map([['B', { node: nodeB, edges: [] }]]),
    };

    const merged = mergeGraphs(g1, g2);
    expect(merged.nodes.size).toBe(2);
    expect(merged.nodes.get('A')?.node).toEqual(nodeA);
    expect(merged.nodes.get('B')?.node).toEqual(nodeB);
  });

  it('unifies edges when node IDs overlap', () => {
    const nodeA = { id: 'A', lat: 1, lng: 1, tags: {} };
    const edge1 = { target: 'B', distance: 10, tags: {} };
    const edge2 = { target: 'C', distance: 15, tags: {} };
    const edgeDuplicate = { target: 'B', distance: 12, tags: {} };

    const g1: StreetGraph = {
      nodes: new Map([['A', { node: nodeA, edges: [edge1] }]]),
    };
    const g2: StreetGraph = {
      nodes: new Map([['A', { node: nodeA, edges: [edge2, edgeDuplicate] }]]),
    };

    const merged = mergeGraphs(g1, g2);
    expect(merged.nodes.size).toBe(1);
    const mergedA = merged.nodes.get('A');
    expect(mergedA?.edges.length).toBe(2);
    expect(mergedA?.edges).toContainEqual(edge1);
    expect(mergedA?.edges).toContainEqual(edge2);
    // Duplicate edge to B should be filtered out
  });
});
