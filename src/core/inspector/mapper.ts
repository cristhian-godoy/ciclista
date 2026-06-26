import type { StreetGraph } from '../graph/types';
import { buildPathSymbolsGeoJSON } from '../rendering/symbols-mapper';
import { getColorForEdge } from '../rendering/theme';
import type { RouteResult } from '../router/types';
import { mapOSMToSignAndRoad } from '../rules';
import type {
  InspectorBranchEvaluation,
  InspectorNodeFeature,
  InspectorRouteSegment,
} from './types';

/**
 * Transforms RouteResult and alternative evaluations into GeoJSON feature collections
 * for rendering visual paths, traffic controls, and turn cues.
 */
export function mapRouteToInspectorGeoJSON(
  route: RouteResult,
  graph: StreetGraph,
  selectedNodeId: string | null = null,
  branches: InspectorBranchEvaluation[] = [],
): {
  segments: { type: 'FeatureCollection'; features: InspectorRouteSegment[] };
  nodes: { type: 'FeatureCollection'; features: InspectorNodeFeature[] };
} {
  const segmentFeatures: InspectorRouteSegment[] = [];
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
  if (selectedNodeId && branches.length > 0) {
    const sourceNode = graph.nodes.get(selectedNodeId)?.node;
    if (sourceNode) {
      branches.forEach((ev) => {
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
  } // 3. Extract Node Symbols/Events
  const nodeFeatures = buildPathSymbolsGeoJSON(route, graph).features;

  return {
    segments: { type: 'FeatureCollection', features: segmentFeatures },
    nodes: { type: 'FeatureCollection', features: nodeFeatures },
  };
}
