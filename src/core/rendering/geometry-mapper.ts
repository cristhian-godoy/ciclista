import type { RouteResult } from '../router/types';
import { getColorForEdge } from './theme';
import type { PathSegmentFeature } from './types';

/**
 * Builds a FeatureCollection of segmented path lines from a RouteResult.
 * Slices the coordinates array and associates each segment with its corresponding edge metadata.
 * Fixes dropped first/last virtual connection segments and preserves road curvature.
 */
export function buildSegmentedPathGeoJSON(
  route: RouteResult,
  isChosenPath: boolean = true,
): {
  type: 'FeatureCollection';
  features: PathSegmentFeature[];
} {
  const features: PathSegmentFeature[] = [];
  const coords = route.coordinates;
  const N = coords.length;

  if (N < 2) {
    return {
      type: 'FeatureCollection',
      features,
    };
  }

  const edges = route.edges || [];
  const E = edges.length;

  // Real edges form a contiguous sequence of E transitions in coords.
  // If there are more transitions than edges, it's due to virtual start/end connections.
  let numStartVirtual = 0;
  if (N - 1 > E) {
    const firstNodeId = route.pathNodeIds?.[0];
    if (firstNodeId === 'virtual-start' || firstNodeId === undefined) {
      numStartVirtual = 1;
    } else {
      numStartVirtual = 1;
    }
  }

  for (let i = 0; i < N - 1; i++) {
    const from = coords[i];
    const to = coords[i + 1];

    if (i < numStartVirtual) {
      // Virtual start connection (e.g. from start pin to snapped network node)
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        },
        properties: {
          color: getColorForEdge(null, ''),
          infrastructureType: null,
          roadType: '',
          surface: null,
          isChosenPath,
          sourceId: 'virtual-start',
          targetId: route.pathNodeIds?.[0],
        },
      });
    } else if (i < numStartVirtual + E) {
      // Real edge from the street graph
      const edgeIndex = i - numStartVirtual;
      const edge = edges[edgeIndex];
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        },
        properties: {
          color: getColorForEdge(edge.matchedSign, edge.matchedRoad),
          infrastructureType: edge.matchedSign,
          roadType: edge.matchedRoad,
          surface: (edge.tags?.surface as string) || null,
          isChosenPath,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          name: edge.name,
        },
      });
    } else {
      // Virtual end connection (e.g. from snapped network node to destination pin)
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        },
        properties: {
          color: getColorForEdge(null, ''),
          infrastructureType: null,
          roadType: '',
          surface: null,
          isChosenPath,
          sourceId: route.pathNodeIds?.[route.pathNodeIds.length - 1],
          targetId: 'virtual-end',
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
