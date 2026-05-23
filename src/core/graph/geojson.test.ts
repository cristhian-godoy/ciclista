import { describe, it, expect } from 'vitest';
import { convertGraphToGeoJSON } from './geojson';
import { OSMGraphParser } from './parser';
import type { StreetGraph } from '../types';

describe('convertGraphToGeoJSON', () => {
  const parser = new OSMGraphParser();
  const defaultDelays = new Map<string, number>();

  it('returns empty lists for empty graphs', () => {
    const emptyGraph: StreetGraph = { nodes: new Map() };
    const result = convertGraphToGeoJSON(emptyGraph, defaultDelays, false);
    expect(result.streets).toEqual([]);
    expect(result.controls).toEqual([]);
  });

  it('converts edges into line features and clusters control nodes within 35 meters', () => {
    const rawData = {
      elements: [
        // Two signals very close (e.g. 5 meters apart) - should cluster
        { type: 'node', id: 1, lat: 48.137, lon: 11.575, tags: { highway: 'traffic_signals' } },
        { type: 'node', id: 2, lat: 48.13705, lon: 11.57505, tags: { highway: 'traffic_signals' } },
        // One yield sign further away (e.g. 100 meters) - should be a separate cluster/crossing
        { type: 'node', id: 3, lat: 48.138, lon: 11.576, tags: { highway: 'give_way' } },
        {
          type: 'way',
          id: 100,
          nodes: [1, 2, 3],
          tags: { highway: 'residential', name: 'Test Blvd' }
        }
      ]
    };

    const graph = parser.parse(rawData);
    // Convert to GeoJSON, showing minor controls (like the yield sign)
    const result = convertGraphToGeoJSON(graph, defaultDelays, true);

    // Verify street line strings
    expect(result.streets.length).toBeGreaterThanOrEqual(2);
    expect(result.streets[0].properties.name).toBe('Test Blvd');
    expect(result.streets[0].geometry.type).toBe('LineString');

    // Verify controls (nodes)
    // We expect:
    // - 2 crossing features (1 clustered crossing for nodes 1&2, 1 crossing for node 3)
    // - 3 individual signal features
    // Total: 5 features
    expect(result.controls.length).toBe(5);

    const crossings = result.controls.filter(f => f.properties.type === 'crossing');
    expect(crossings.length).toBe(2);

    // Verify the clustered crossing has both node ids in properties.nodeIds
    const clusterCrossing = crossings.find(c => {
      const ids = JSON.parse(c.properties.nodeIds as string);
      return ids.includes('1') && ids.includes('2');
    });
    expect(clusterCrossing).toBeDefined();
    expect(clusterCrossing?.properties.controlType).toBe('signal'); // dominant type

    const singleCrossing = crossings.find(c => {
      const ids = JSON.parse(c.properties.nodeIds as string);
      return ids.includes('3');
    });
    expect(singleCrossing).toBeDefined();
    expect(singleCrossing?.properties.controlType).toBe('yield');
  });

  it('hides minor controls unless showMinorControls is checked or they have custom overrides', () => {
    const rawData = {
      elements: [
        { type: 'node', id: 1, lat: 48.137, lon: 11.575, tags: { highway: 'traffic_signals' } }, // signal
        { type: 'node', id: 2, lat: 48.138, lon: 11.576, tags: { highway: 'give_way' } },        // minor (yield)
        { type: 'node', id: 3, lat: 48.139, lon: 11.577, tags: { highway: 'stop' } },            // minor (stop) with override
        {
          type: 'way',
          id: 100,
          nodes: [1, 2, 3],
          tags: { highway: 'residential' }
        }
      ]
    };

    const graph = parser.parse(rawData);
    const overrides = new Map<string, number>([['3', 15]]); // node 3 has override

    // We do NOT show minor controls (showMinorControls = false)
    const result = convertGraphToGeoJSON(graph, overrides, false);

    // Node 1 (signal) -> visible
    // Node 2 (yield, minor, no override) -> hidden
    // Node 3 (stop, minor, has override) -> visible
    // So 2 individual features and 2 crossings = 4 controls
    expect(result.controls.length).toBe(4);

    const individualSignals = result.controls.filter(f => f.properties.type === 'signal');
    const ids = individualSignals.map(s => s.properties.id);
    expect(ids).toContain('1');
    expect(ids).toContain('3');
    expect(ids).not.toContain('2');
  });
});
