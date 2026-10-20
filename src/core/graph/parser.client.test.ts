import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseInWorker } from './parser.client';

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
});
