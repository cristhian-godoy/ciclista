import { describe, expect, it } from 'vitest';

import type { RouteResult } from '../router/types';
import { buildSegmentedPathGeoJSON } from './geometry-mapper';
import { PALETTES } from './theme';

describe('Geometry Mapper', () => {
  it('handles empty or single coordinate paths gracefully', () => {
    const emptyRoute: RouteResult = {
      pathNodeIds: [],
      coordinates: [],
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
      streets: [],
      trafficSignalsCount: 0,
      signalCount: 0,
      yieldCount: 0,
      crossingCount: 0,
      roadTypeTotals: {},
      surfaceTotals: { paved: 0, gravel: 0, cobblestone: 0 },
    };

    const emptyRes = buildSegmentedPathGeoJSON(emptyRoute);
    expect(emptyRes.features).toHaveLength(0);

    const singleRoute: RouteResult = {
      ...emptyRoute,
      coordinates: [{ lat: 10, lng: 20 }],
    };
    const singleRes = buildSegmentedPathGeoJSON(singleRoute);
    expect(singleRes.features).toHaveLength(0);
  });

  it('slices coordinates and maps real edges and virtual segments accurately', () => {
    // Route from pin start to pin end:
    // coordinates: [startPin, virtualStartNode, node1, virtualEndNode, endPin]
    // pathNodeIds: ['virtual-start', 'node-1', 'virtual-end']
    // edges: 2 edges (virtualStartNode -> node1, node1 -> virtualEndNode)
    const route: RouteResult = {
      pathNodeIds: ['virtual-start', 'node-1', 'virtual-end'],
      coordinates: [
        { lat: 0, lng: 0 }, // start pin
        { lat: 1, lng: 1 }, // virtual start
        { lat: 2, lng: 2 }, // node 1
        { lat: 3, lng: 3 }, // virtual end
        { lat: 4, lng: 4 }, // end pin
      ],
      totalDurationSeconds: 100,
      totalDistanceMeters: 1000,
      streets: ['St', 'Ave'],
      trafficSignalsCount: 0,
      signalCount: 0,
      yieldCount: 0,
      crossingCount: 0,
      roadTypeTotals: {},
      surfaceTotals: { paved: 0, gravel: 0, cobblestone: 0 },
      edges: [
        {
          sourceId: 'virtual-start',
          targetId: 'node-1',
          name: 'Street A',
          distance: 100,
          highway: 'residential',
          tags: {},
          cost: 10,
          matchedSign: 'segregated_path',
          matchedRoad: 'residential',
        },
        {
          sourceId: 'node-1',
          targetId: 'virtual-end',
          name: 'Street B',
          distance: 200,
          highway: 'primary',
          tags: {},
          cost: 30,
          matchedSign: null,
          matchedRoad: 'primary',
        },
      ],
    };

    const res = buildSegmentedPathGeoJSON(route);

    // Should have 4 segments total:
    // 1. startPin -> virtualStartNode (virtual start connection)
    // 2. virtualStartNode -> node1 (real edge 1)
    // 3. node1 -> virtualEndNode (real edge 2)
    // 4. virtualEndNode -> endPin (virtual end connection)
    expect(res.features).toHaveLength(4);

    // Segment 1 (Virtual Start)
    expect(res.features[0].geometry.coordinates).toEqual([
      [0, 0],
      [1, 1],
    ]);
    expect(res.features[0].properties.sourceId).toBe('virtual-start');
    expect(res.features[0].properties.infrastructureType).toBeNull();
    expect(res.features[0].properties.color).toBe(PALETTES.semantic.acceptable);

    // Segment 2 (Real Edge 1)
    expect(res.features[1].geometry.coordinates).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(res.features[1].properties.sourceId).toBe('virtual-start');
    expect(res.features[1].properties.targetId).toBe('node-1');
    expect(res.features[1].properties.infrastructureType).toBe('segregated_path');
    expect(res.features[1].properties.color).toBe(PALETTES.semantic.safe); // Green/Safe

    // Segment 3 (Real Edge 2)
    expect(res.features[2].geometry.coordinates).toEqual([
      [2, 2],
      [3, 3],
    ]);
    expect(res.features[2].properties.sourceId).toBe('node-1');
    expect(res.features[2].properties.targetId).toBe('virtual-end');
    expect(res.features[2].properties.roadType).toBe('primary');
    expect(res.features[2].properties.color).toBe(PALETTES.semantic.danger); // Red/Danger

    // Segment 4 (Virtual End)
    expect(res.features[3].geometry.coordinates).toEqual([
      [3, 3],
      [4, 4],
    ]);
    expect(res.features[3].properties.targetId).toBe('virtual-end');
    expect(res.features[3].properties.infrastructureType).toBeNull();
  });
});
