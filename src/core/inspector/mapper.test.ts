import { describe, expect, it } from 'vitest';

import { OSMGraphParser } from '../graph/parser';
import type { RouteResult } from '../router/types';
import { mapRouteToInspectorGeoJSON } from './mapper';

describe('mapRouteToInspectorGeoJSON', () => {
  const parser = new OSMGraphParser();

  it('maps empty RouteResult correctly', () => {
    const graph = { nodes: new Map() };
    const route: RouteResult = {
      pathNodeIds: [],
      coordinates: [],
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
      streets: [],
      trafficSignalsCount: 0,
      yieldCount: 0,
      signalCount: 0,
      crossingCount: 0,
      roadTypeTotals: {},
      surfaceTotals: { paved: 0, gravel: 0, cobblestone: 0 },
    };

    const result = mapRouteToInspectorGeoJSON(route, graph);
    expect(result.segments.features).toEqual([]);
    expect(result.nodes.features).toEqual([]);
  });

  it('maps chosen path edges and alternative evaluations correctly', () => {
    const rawData = {
      elements: [
        { type: 'node', id: 1, lat: 48.1, lon: 11.1, tags: { highway: 'traffic_signals' } },
        { type: 'node', id: 2, lat: 48.2, lon: 11.2, tags: { highway: 'stop' } },
        { type: 'node', id: 3, lat: 48.3, lon: 11.3 },
        { type: 'way', id: 100, nodes: [1, 2, 3], tags: { highway: 'cycleway' } },
      ],
    };
    const graph = parser.parse(rawData);
    const route: RouteResult = {
      pathNodeIds: ['1', '2', '3'],
      coordinates: [
        { lat: 48.1, lng: 11.1 },
        { lat: 48.2, lng: 11.2 },
        { lat: 48.3, lng: 11.3 },
      ],
      totalDurationSeconds: 10,
      totalDistanceMeters: 100,
      streets: ['cycleway'],
      trafficSignalsCount: 1,
      yieldCount: 0,
      signalCount: 1,
      crossingCount: 0,
      roadTypeTotals: {},
      surfaceTotals: { paved: 0, gravel: 0, cobblestone: 0 },
      edges: [
        {
          sourceId: '1',
          targetId: '2',
          name: 'Cycleway A',
          distance: 50,
          highway: 'cycleway',
          tags: {},
          cost: 5,
          matchedSign: 'segregated_path',
          matchedRoad: 'path_default',
        },
        {
          sourceId: '2',
          targetId: '3',
          name: 'Cycleway B',
          distance: 50,
          highway: 'cycleway',
          tags: {},
          cost: 5,
          matchedSign: 'segregated_path',
          matchedRoad: 'path_default',
        },
      ],
      alternativeEvaluations: {
        '2': [
          {
            targetId: '3',
            name: 'Cycleway B',
            distance: 50,
            highway: 'cycleway',
            baseSpeedKmh: 15,
            effectiveSpeedKmh: 15,
            surface: 'paved',
            flatPenaltySeconds: 0,
            comfort: 'high',
            matchedSign: 'segregated_path',
            matchedRoad: 'path_default',
            routingWeight: 5,
            displayCostSeconds: 5,
            isRestricted: false,
            turnPenaltySeconds: 0,
            nodeDelaySeconds: 0,
            nodeDelayType: null,
            restrictionReason: null,
          },
          {
            targetId: '4', // alternative target node not in chosen route
            name: 'Alternative Primary Road',
            distance: 80,
            highway: 'primary',
            baseSpeedKmh: 20,
            effectiveSpeedKmh: 18,
            surface: 'paved',
            flatPenaltySeconds: 0,
            comfort: 'neutral',
            matchedSign: null,
            matchedRoad: 'primary',
            routingWeight: 15,
            displayCostSeconds: 15,
            isRestricted: false,
            turnPenaltySeconds: 0,
            nodeDelaySeconds: 0,
            nodeDelayType: null,
            restrictionReason: null,
          },
        ],
      },
    };

    // Add node 4 manually to graph so it resolves coordinate
    graph.nodes.set('4', {
      node: { id: '4', lat: 48.4, lng: 11.4, tags: {} },
      edges: [],
    });

    const result = mapRouteToInspectorGeoJSON(route, graph);

    // 2 chosen edges + 1 alternative edge (targetId 4) = 3 segments
    expect(result.segments.features.length).toBe(3);
    const chosenSegments = result.segments.features.filter((f) => f.properties.isChosenPath);
    const altSegments = result.segments.features.filter((f) => !f.properties.isChosenPath);
    expect(chosenSegments.length).toBe(2);
    expect(altSegments.length).toBe(1);

    // Green color for segregated path
    expect(chosenSegments[0].properties.color).toBe('#10b981');
    // Red color for primary alternative path
    expect(altSegments[0].properties.color).toBe('#ef4444');

    // Controls nodes: node 1 (traffic signal), node 2 (stop sign)
    const controlFeatures = result.nodes.features.filter((f) => f.properties.type !== 'turn');
    expect(controlFeatures.length).toBe(2);
    expect(controlFeatures[0].properties.type).toBe('signal');
    expect(controlFeatures[1].properties.type).toBe('stop');
  });
});
