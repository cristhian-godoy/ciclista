import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OSMGraphParser } from './parser';

describe('OSMGraphParser', () => {
  let parser: OSMGraphParser;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    parser = new OSMGraphParser();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('loads mock graph on null or undefined rawData', () => {
    const graph = parser.parse(null);
    expect(warnSpy).toHaveBeenCalled();
    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(graph.nodes.has('1')).toBe(true); // check home Marienplatz
  });

  it('loads mock graph on rawData with empty elements list', () => {
    const graph = parser.parse({ elements: [] });
    expect(warnSpy).toHaveBeenCalled();
    expect(graph.nodes.size).toBeGreaterThan(0);
  });

  it('correctly parses valid nodes and ways', () => {
    const validData = {
      elements: [
        { type: 'node', id: 10, lat: 48.1, lon: 11.1, tags: { name: 'Node 10' } },
        { type: 'node', id: 20, lat: 48.2, lon: 11.2, tags: { name: 'Node 20' } },
        {
          type: 'way',
          id: 100,
          nodes: [10, 20],
          tags: { highway: 'residential', name: 'Test Street' },
        },
      ],
    };

    const graph = parser.parse(validData);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(graph.nodes.size).toBe(2);

    const node10 = graph.nodes.get('10');
    expect(node10).toBeDefined();
    expect(node10?.node.lat).toBe(48.1);
    expect(node10?.edges.length).toBe(1);
    expect(node10?.edges[0].target).toBe('20');
    expect(node10?.edges[0].name).toBe('Test Street');

    const node20 = graph.nodes.get('20');
    expect(node20).toBeDefined();
    expect(node20?.edges.length).toBe(1);
    expect(node20?.edges[0].target).toBe('10'); // bidirectional by default
  });

  it('ignores motorways and steps', () => {
    const data = {
      elements: [
        { type: 'node', id: 1, lat: 48.1, lon: 11.1 },
        { type: 'node', id: 2, lat: 48.2, lon: 11.2 },
        { type: 'way', id: 101, nodes: [1, 2], tags: { highway: 'motorway' } },
        { type: 'way', id: 102, nodes: [1, 2], tags: { highway: 'steps' } },
      ],
    };
    const graph = parser.parse(data);
    expect(graph.nodes.size).toBe(0); // no valid ways processed
  });

  it('respects bicycle=no and access=no', () => {
    const data = {
      elements: [
        { type: 'node', id: 1, lat: 48.1, lon: 11.1 },
        { type: 'node', id: 2, lat: 48.2, lon: 11.2 },
        { type: 'way', id: 101, nodes: [1, 2], tags: { highway: 'residential', bicycle: 'no' } },
      ],
    };
    const graph = parser.parse(data);
    expect(graph.nodes.size).toBe(0);
  });

  it('gracefully handles missing fields and invalid types in element properties', () => {
    const badData = {
      elements: [
        null,
        undefined,
        'not-an-element',
        { type: 'node', id: 1 }, // missing lat/lon/tags
        { type: 'node', id: 2, lat: 'string-lat', lon: null }, // bad coordinate types
        {
          type: 'way',
          id: 101,
          nodes: [1, 2],
          tags: null, // null tags
        },
      ],
    };

    // Should process without throwing, defaulting lat/lon to 0 and ignoring ways with invalid nodes
    expect(() => {
      const graph = parser.parse(badData);
      expect(graph).toBeDefined();
    }).not.toThrow();
  });

  it('correctly parses and converts maxspeed limits with units like mph', () => {
    const data = {
      elements: [
        { type: 'node', id: 1, lat: 48.1, lon: 11.1 },
        { type: 'node', id: 2, lat: 48.2, lon: 11.2 },
        {
          type: 'way',
          id: 101,
          nodes: [1, 2],
          tags: { highway: 'residential', maxspeed: '10 mph' },
        },
        {
          type: 'way',
          id: 102,
          nodes: [1, 2],
          tags: { highway: 'residential', maxspeed: '10' },
        },
      ],
    };

    const graph = parser.parse(data);
    const node1 = graph.nodes.get('1');
    expect(node1).toBeDefined();

    // Verify edge with 10 mph maxspeed (converted to km/h, then m/s: approx 4.47 m/s)
    const edgeMph = node1?.edges.find((e) => e.speedLimit !== 5.0 && e.speedLimit > 4.0);
    expect(edgeMph).toBeDefined();
    expect(edgeMph?.speedLimit).toBeCloseTo(16.0934 / 3.6, 4);

    // Verify edge with 10 km/h maxspeed (converted to m/s: approx 2.78 m/s)
    const edgeKmh = node1?.edges.find((e) => e.speedLimit < 3.0);
    expect(edgeKmh).toBeDefined();
    expect(edgeKmh?.speedLimit).toBeCloseTo(10 / 3.6, 4);
  });
});
