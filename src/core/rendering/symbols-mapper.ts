import type { StreetGraph } from '../graph/types';
import { calculateBearing } from '../navigation/engine';
import type { RouteResult } from '../router/types';
import { getTurnDetails, mapOSMNodeToControl } from '../rules';
import type { PathNodeFeature } from './types';

/**
 * Extracts point symbol features (traffic lights, yields, crossings, turns)
 * along a route path for map visualization.
 */
export function buildPathSymbolsGeoJSON(
  route: RouteResult,
  graph: StreetGraph,
): {
  type: 'FeatureCollection';
  features: PathNodeFeature[];
} {
  const nodeFeatures: PathNodeFeature[] = [];
  const pathNodeIds = route.pathNodeIds || [];

  pathNodeIds.forEach((nodeId, idx) => {
    const entry = graph.nodes.get(nodeId);
    if (!entry) return;
    const u = entry.node;
    const tags = u.tags || {};

    const controlType = mapOSMNodeToControl(tags);

    if (controlType) {
      let bearing = 0;
      if (idx < pathNodeIds.length - 1) {
        const nextId = pathNodeIds[idx + 1];
        const nextNode = nextId ? graph.nodes.get(nextId)?.node : undefined;
        if (nextNode) {
          bearing = calculateBearing(u, nextNode);
        }
      } else if (idx > 0) {
        const prevId = pathNodeIds[idx - 1];
        const prevNode = prevId ? graph.nodes.get(prevId)?.node : undefined;
        if (prevNode) {
          bearing = calculateBearing(prevNode, u);
        }
      }

      nodeFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [u.lng, u.lat],
        },
        properties: {
          type: controlType,
          bearing,
        },
      });
    }

    if (idx > 0 && idx < pathNodeIds.length - 1) {
      const prevId = pathNodeIds[idx - 1];
      const nextId = pathNodeIds[idx + 1];
      const prevNode = prevId ? graph.nodes.get(prevId)?.node : undefined;
      const nextNode = nextId ? graph.nodes.get(nextId)?.node : undefined;
      if (prevNode && nextNode) {
        const turn = getTurnDetails(prevNode, u, nextNode);
        if (
          turn.direction === 'left' ||
          turn.direction === 'right' ||
          turn.direction === 'u-turn'
        ) {
          const bearing = calculateBearing(u, nextNode);
          nodeFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [u.lng, u.lat],
            },
            properties: {
              type: 'turn',
              turnDirection: turn.direction,
              bearing,
            },
          });
        }
      }
    }
  });

  return {
    type: 'FeatureCollection',
    features: nodeFeatures,
  };
}
