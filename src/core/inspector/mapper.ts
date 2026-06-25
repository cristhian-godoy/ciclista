import { getTurnDetails } from '../common/geometry';
import type { StreetGraph } from '../graph/types';
import { calculateBearing } from '../navigation/engine';
import { mapOSMToSignAndRoad } from '../router/rules';
import type { RouteResult } from '../router/types';
import type { InspectorNodeFeature, InspectorRouteSegment } from './types';

/**
 * Maps matched infrastructure or road types to standard color codes.
 */
export function getColorForEdge(matchedSign: string | null, matchedRoad: string): string {
  if (matchedSign === 'segregated_path' || matchedSign === 'bicycle_street') {
    return '#10b981'; // Green (Safe/Pleasant)
  }
  if (matchedSign === 'pedestrian_zone' || matchedSign === 'sidewalk') {
    return '#8b5cf6'; // Purple (Dismount/Penalty)
  }
  if (matchedSign === 'shared_path' || matchedSign === 'living_street') {
    return '#3b82f6'; // Blue (Acceptable)
  }
  if (matchedRoad === 'primary' || matchedRoad === 'secondary') {
    return '#ef4444'; // Red (Danger)
  }
  // Generic cycle-friendly paths (e.g. residential, service, path_default)
  return '#3b82f6'; // Blue (Acceptable)
}

/**
 * Transforms RouteResult and alternative evaluations into GeoJSON feature collections
 * for rendering visual paths, traffic controls, and turn cues.
 */
export function mapRouteToInspectorGeoJSON(
  route: RouteResult,
  graph: StreetGraph,
  selectedNodeId: string | null = null,
): {
  segments: { type: 'FeatureCollection'; features: InspectorRouteSegment[] };
  nodes: { type: 'FeatureCollection'; features: InspectorNodeFeature[] };
} {
  const segmentFeatures: InspectorRouteSegment[] = [];
  const nodeFeatures: InspectorNodeFeature[] = [];
  const processedSegments = new Set<string>();

  // 1. Process Chosen Path segments
  if (route.edges && route.edges.length > 0) {
    route.edges.forEach((edge) => {
      const sourceNode = graph.nodes.get(edge.sourceId)?.node;
      const targetNode = graph.nodes.get(edge.targetId)?.node;
      if (!sourceNode || !targetNode) return;

      const segKey = `${edge.sourceId}->${edge.targetId}`;
      processedSegments.add(segKey);

      segmentFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [sourceNode.lng, sourceNode.lat],
            [targetNode.lng, targetNode.lat],
          ],
        },
        properties: {
          color: getColorForEdge(edge.matchedSign, edge.matchedRoad),
          infrastructureType: edge.matchedSign,
          roadType: edge.matchedRoad,
          surface: (edge.tags?.surface as string) || null,
          isChosenPath: true,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
        },
      });
    });
  } else if (route.pathNodeIds && route.pathNodeIds.length > 1) {
    for (let i = 0; i < route.pathNodeIds.length - 1; i++) {
      const uId = route.pathNodeIds[i];
      const vId = route.pathNodeIds[i + 1];
      const uNode = graph.nodes.get(uId)?.node;
      const vNode = graph.nodes.get(vId)?.node;
      if (!uNode || !vNode) continue;

      const segKey = `${uId}->${vId}`;
      processedSegments.add(segKey);

      const uEntry = graph.nodes.get(uId);
      const edge = uEntry?.edges.find((e) => e.target === vId);
      const highway = edge?.tags?.highway || '';
      const tags = edge?.tags || {};
      const { sign, road } = mapOSMToSignAndRoad(highway, tags);

      segmentFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [uNode.lng, uNode.lat],
            [vNode.lng, vNode.lat],
          ],
        },
        properties: {
          color: getColorForEdge(sign, road),
          infrastructureType: sign,
          roadType: road,
          surface: tags.surface || null,
          isChosenPath: true,
          sourceId: uId,
          targetId: vId,
        },
      });
    }
  }

  // 2. Process Alternative Evaluations (only for the selected node)
  if (route.alternativeEvaluations && selectedNodeId) {
    const evals = route.alternativeEvaluations[selectedNodeId];
    if (evals) {
      const sourceNode = graph.nodes.get(selectedNodeId)?.node;
      if (sourceNode) {
        evals.forEach((ev) => {
          const targetNode = graph.nodes.get(ev.targetId)?.node;
          if (!targetNode) return;

          const segKey = `${selectedNodeId}->${ev.targetId}`;
          const isChosen = processedSegments.has(segKey);
          if (isChosen) return;

          const coords =
            ev.altCoordinates && ev.altCoordinates.length >= 2
              ? ev.altCoordinates.map((c) => [c.lng, c.lat])
              : [
                  [sourceNode.lng, sourceNode.lat],
                  [targetNode.lng, targetNode.lat],
                ];

          segmentFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: {
              color: getColorForEdge(ev.matchedSign, ev.matchedRoad),
              infrastructureType: ev.matchedSign,
              roadType: ev.matchedRoad,
              surface: ev.surface || null,
              isChosenPath: false,
              sourceId: selectedNodeId,
              targetId: ev.targetId,
            },
          });
        });
      }
    }
  }

  // 3. Extract Node Symbols/Events
  const pathNodeIds = route.pathNodeIds || [];
  pathNodeIds.forEach((nodeId, idx) => {
    const entry = graph.nodes.get(nodeId);
    if (!entry) return;
    const u = entry.node;
    const tags = u.tags || {};

    let controlType: 'signal' | 'yield' | 'stop' | 'crossing' | null = null;
    if (tags.highway === 'traffic_signals' || tags.crossing === 'traffic_signals') {
      controlType = 'signal';
    } else if (tags.highway === 'give_way') {
      controlType = 'yield';
    } else if (tags.highway === 'stop') {
      controlType = 'stop';
    } else if (tags.highway === 'crossing' || tags.crossing) {
      controlType = 'crossing';
    }

    if (controlType) {
      let bearing = 0;
      if (idx < pathNodeIds.length - 1) {
        const nextNode = graph.nodes.get(pathNodeIds[idx + 1])?.node;
        if (nextNode) {
          bearing = calculateBearing(u, nextNode);
        }
      } else if (idx > 0) {
        const prevNode = graph.nodes.get(pathNodeIds[idx - 1])?.node;
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
      const prevNode = graph.nodes.get(pathNodeIds[idx - 1])?.node;
      const nextNode = graph.nodes.get(pathNodeIds[idx + 1])?.node;
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
    segments: { type: 'FeatureCollection', features: segmentFeatures },
    nodes: { type: 'FeatureCollection', features: nodeFeatures },
  };
}
