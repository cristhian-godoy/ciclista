import type { IncomingEdgeRef, StreetGraph } from './types';

/**
 * Merges two StreetGraph instances together.
 *
 * @param g1 - The first street graph.
 * @param g2 - The second street graph.
 * @returns The merged street graph containing nodes and edges from both.
 */
export const mergeGraphs = (g1: StreetGraph, g2: StreetGraph): StreetGraph => {
  const mergedNodes = g1.nodes; // Mutate in-place to avoid massive GC and CPU cost
  // Invalidate any existing incoming edge index on graph mutation
  g1.incomingEdgesIndex = undefined;

  for (const [key, val] of g2.nodes.entries()) {
    const existing = mergedNodes.get(key);
    if (existing) {
      const targets = new Set<string>();
      for (const edge of existing.edges) {
        targets.add(edge.target);
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

/**
 * Retrieves incoming edges targeting a specified node, utilizing or lazily populating
 * an incoming edge index on the graph for O(1) retrieval.
 *
 * @param graph - Street graph containing network vertices and edges.
 * @param targetNodeId - Node identifier for which incoming edges should be fetched.
 * @returns Array of incoming edge references leading into targetNodeId.
 */
export function getIncomingEdges(graph: StreetGraph, targetNodeId: string): IncomingEdgeRef[] {
  if (!graph.incomingEdgesIndex) {
    const index = new Map<string, IncomingEdgeRef[]>();
    for (const [sourceId, entry] of graph.nodes.entries()) {
      for (const edge of entry.edges) {
        let list = index.get(edge.target);
        if (!list) {
          list = [];
          index.set(edge.target, list);
        }
        list.push({ sourceId, edge });
      }
    }
    graph.incomingEdgesIndex = index;
  }
  return graph.incomingEdgesIndex.get(targetNodeId) ?? [];
}
