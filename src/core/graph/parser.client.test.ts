import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseInWorker } from './parser.client';

describe('parser.client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to main-thread parsing when Worker is undefined', async () => {
    // Save global Worker
    const originalWorker = globalThis.Worker;
    // Force Worker to be undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).Worker;

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
      // Restore global Worker
      globalThis.Worker = originalWorker;
    }
  });
});
