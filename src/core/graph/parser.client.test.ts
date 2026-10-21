import { beforeEach, describe, expect, it, vi } from 'vitest';

import { convertGraphToGeoJSONInWorker, parseInWorker } from './parser.client';
import type { StreetGraph } from './types';

describe('parser.client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to main-thread parsing when Worker is undefined', async () => {
    const originalWorker = globalThis.Worker;
    Reflect.deleteProperty(globalThis, 'Worker');

    const mockResponse = {
      elements: [
        {
          type: 'way',
          id: 1,
          nodes: [10, 11],
          geometry: [
            { lat: 48.133, lon: 11.573 },
            { lat: 48.134, lon: 11.574 },
          ],
          tags: { highway: 'residential' },
        },
      ],
    };

    try {
      const graph = await parseInWorker(mockResponse);
      expect(graph).toBeDefined();
      expect(graph.nodes.size).toBeGreaterThan(0);
    } finally {
      if (originalWorker) {
        globalThis.Worker = originalWorker;
      }
    }
  });

  it('convertGraphToGeoJSONInWorker converts graph features without throwing', async () => {
    const tags1: Record<string, string> = { highway: 'traffic_signals' };
    const tags2: Record<string, string> = {};
    const edgeTags: Record<string, string> = { highway: 'residential' };

    const mockGraph: StreetGraph = {
      nodes: new Map([
        [
          '1',
          {
            node: { id: '1', lat: 48.13, lng: 11.57, tags: tags1 },
            edges: [
              {
                target: '2',
                distance: 100,
                name: 'Main St',
                tags: edgeTags,
              },
            ],
          },
        ],
        [
          '2',
          {
            node: { id: '2', lat: 48.131, lng: 11.571, tags: tags2 },
            edges: [],
          },
        ],
      ]),
    };

    const result = await convertGraphToGeoJSONInWorker(mockGraph);
    expect(result.streets).toHaveLength(1);
    expect(result.controls).toHaveLength(2); // 1 crossing + 1 signal
  });
});
