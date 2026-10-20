import { useMemo } from 'react';

import type { StreetGraph } from '../core/graph/types';

/**
 * Descriptor for an edge entry to be rendered as GeoJSON with optional custom properties.
 */
export interface EdgeFeatureEntry {
  edgeId: string;
  extraProperties?: Record<string, unknown>;
}

/**
 * Custom React hook that transforms a collection of graph edge identifiers into a GeoJSON FeatureCollection.
 *
 * @param graph - Active street graph containing node coordinates.
 * @param edges - Array of edge identifiers or objects containing edge IDs and custom properties.
 * @returns GeoJSON FeatureCollection containing LineString features for valid edges.
 */
export function useEdgeGeoJSON(
  graph: StreetGraph | null,
  edges: Array<string | EdgeFeatureEntry>,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return useMemo(() => {
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    if (!graph || edges.length === 0) {
      return {
        type: 'FeatureCollection',
        features,
      };
    }

    const processedEdges = new Set<string>();

    for (const item of edges) {
      const edgeId = typeof item === 'string' ? item : item.edgeId;
      const extraProperties = typeof item === 'string' ? undefined : item.extraProperties;

      if (processedEdges.has(edgeId)) continue;
      processedEdges.add(edgeId);

      const [sourceId, targetId] = edgeId.split('->');
      if (!sourceId || !targetId) continue;

      const sourceEntry = graph.nodes.get(sourceId);
      const targetEntry = graph.nodes.get(targetId);
      if (!sourceEntry || !targetEntry) continue;

      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [sourceEntry.node.lng, sourceEntry.node.lat],
            [targetEntry.node.lng, targetEntry.node.lat],
          ],
        },
        properties: {
          edgeId,
          sourceId,
          targetId,
          ...extraProperties,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [graph, edges]);
}
