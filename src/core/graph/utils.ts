import type { StreetGraph } from './types';

/**
 * Merges two StreetGraph instances together.
 *
 * @param g1 - The first street graph.
 * @param g2 - The second street graph.
 * @returns The merged street graph containing nodes and edges from both.
 */
export const mergeGraphs = (g1: StreetGraph, g2: StreetGraph): StreetGraph => {
  const mergedNodes = g1.nodes; // Mutate in-place to avoid massive GC and CPU cost

  for (const [key, val] of g2.nodes.entries()) {
    const existing = mergedNodes.get(key);
    if (existing) {
      const targets = new Set<string>();
      const existingEdges = existing.edges;
      for (let i = 0; i < existingEdges.length; i++) {
        targets.add(existingEdges[i].target);
      }

      const newEdges = val.edges.filter((e) => !targets.has(e.target));
      if (newEdges.length > 0) {
        // Mutate existing entry instead of replacing it
        existing.edges.push(...newEdges);
      }
    } else {
      mergedNodes.set(key, val);
    }
  }

  // Return a new wrapper object to trigger React state updates, but reuse the Map
  return { nodes: mergedNodes };
};
