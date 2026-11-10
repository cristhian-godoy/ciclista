import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Coordinate } from '../common/types';
import type { LocalOverrides } from '../config';
import type { StreetGraph } from '../graph/types';
import * as wasmModule from '../wasm';
import type { StrategyRouteVariant, WorkerRoutingRequest, WorkerRoutingResponse } from './types';

describe('router.worker unit tests', () => {
  const originalPostMessage = globalThis.postMessage;
  let postMessageMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    await wasmModule.ensureWasmInitialized();
  });

  const mockGraph: StreetGraph = {
    nodes: new Map([
      [
        'node-1',
        {
          node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: {} },
          edges: [
            {
              target: 'node-2',
              distance: 100,
              cost: 10,
              tags: { highway: 'cycleway' },
            },
          ],
        },
      ],
      [
        'node-2',
        {
          node: { id: 'node-2', lat: 48.138, lng: 11.576, tags: {} },
          edges: [
            {
              target: 'node-1',
              distance: 100,
              cost: 10,
              tags: { highway: 'cycleway' },
            },
          ],
        },
      ],
    ]),
  };

  const startCoord: Coordinate = { lat: 48.137, lng: 11.575 };
  const endCoord: Coordinate = { lat: 48.138, lng: 11.576 };
  const defaultOverrides: LocalOverrides = {
    nodeDelays: new Map(),
    nodeNotes: new Map(),
    nodeTurns: new Map(),
  };

  beforeEach(() => {
    postMessageMock = vi.fn();
    (globalThis as unknown as { postMessage: typeof postMessageMock }).postMessage =
      postMessageMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { postMessage: typeof originalPostMessage }).postMessage =
      originalPostMessage;
  });

  it('delegates to WASM engine when initialized and no waypoints are provided', async () => {
    const mockVariants = [
      {
        label: 'standard' as const,
        result: {
          pathNodeIds: ['node-1', 'node-2'],
          coordinates: [startCoord, endCoord],
          totalDurationSeconds: 15,
          totalDistanceMeters: 100,
          streets: ['Cycleway'],
          trafficSignalsCount: 0,
          yieldCount: 0,
          signalCount: 0,
          crossingCount: 0,
          roadTypeTotals: {},
          surfaceTotals: { paved: 100, gravel: 0, cobblestone: 0 },
        },
      },
    ];

    vi.spyOn(wasmModule, 'ensureWasmInitialized').mockResolvedValue(true);
    vi.spyOn(wasmModule.WasmStreetGraph.prototype, 'find_route_variants').mockReturnValue(
      mockVariants,
    );

    // Import worker script to register self.onmessage
    await import('./router.worker');

    const request: WorkerRoutingRequest = {
      requestId: 'req-wasm-1',
      graph: mockGraph,
      startCoord,
      endCoord,
      overrides: defaultOverrides,
      algorithm: 'astar',
    };

    await (self.onmessage as (e: MessageEvent<WorkerRoutingRequest>) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as WorkerRoutingResponse;
    expect(response).toBeDefined();
    expect(response.requestId).toBe('req-wasm-1');
    expect(response.routeVariants).toEqual(mockVariants);
  });

  it('serializes Set fields in overrides before delegating to WASM engine', async () => {
    const mockVariants: StrategyRouteVariant[] = [
      {
        label: 'standard',
        result: {
          pathNodeIds: ['1', '2'],
          coordinates: [startCoord, endCoord],
          totalDistanceMeters: 100,
          totalDurationSeconds: 20,
          streets: ['Street A'],
          trafficSignalsCount: 0,
          yieldCount: 0,
          signalCount: 0,
          crossingCount: 0,
          roadTypeTotals: {},
          surfaceTotals: { paved: 100, gravel: 0, cobblestone: 0 },
        },
      },
    ];

    vi.spyOn(wasmModule, 'ensureWasmInitialized').mockResolvedValue(true);
    const findRouteSpy = vi
      .spyOn(wasmModule.WasmStreetGraph.prototype, 'find_route_variants')
      .mockReturnValue(mockVariants);

    await import('./router.worker');

    const overridesWithSet: LocalOverrides = {
      ...defaultOverrides,
      blockedEdges: new Set(['1->2']),
    };

    const request: WorkerRoutingRequest = {
      requestId: 'req-wasm-set',
      graph: mockGraph,
      startCoord,
      endCoord,
      overrides: overridesWithSet,
      algorithm: 'astar',
    };

    await (self.onmessage as (e: MessageEvent<WorkerRoutingRequest>) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    expect(findRouteSpy).toHaveBeenCalledTimes(1);
    const passedOverrides = findRouteSpy.mock.calls[0]?.[2] as { blockedEdges?: unknown };
    expect(Array.isArray(passedOverrides?.blockedEdges)).toBe(true);
    expect(passedOverrides?.blockedEdges).toEqual(['1->2']);

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as WorkerRoutingResponse;
    expect(response.requestId).toBe('req-wasm-set');
    expect(response.routeVariants).toEqual(mockVariants);
  });

  it('falls back to TypeScript engine when WASM computation throws', async () => {
    vi.spyOn(wasmModule, 'ensureWasmInitialized').mockResolvedValue(true);
    vi.spyOn(wasmModule.WasmStreetGraph.prototype, 'find_route_variants').mockImplementation(() => {
      throw new Error('WASM memory error');
    });

    await import('./router.worker');

    const request: WorkerRoutingRequest = {
      requestId: 'req-fallback-1',
      graph: mockGraph,
      startCoord,
      endCoord,
      overrides: defaultOverrides,
      algorithm: 'astar',
    };

    await (self.onmessage as (e: MessageEvent<WorkerRoutingRequest>) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as WorkerRoutingResponse;
    expect(response).toBeDefined();
    expect(response.requestId).toBe('req-fallback-1');
    expect(response.routeVariants).toBeDefined();
    expect(response.routeVariants?.length).toBeGreaterThan(0);
    expect(response.routeVariants?.[0]?.label).toBe('standard');
  });

  it('routes with Dijkstra algorithm when algorithm=dijkstra', async () => {
    vi.spyOn(wasmModule, 'ensureWasmInitialized').mockResolvedValue(false);

    await import('./router.worker');

    const request: WorkerRoutingRequest = {
      requestId: 'req-dijkstra-1',
      graph: mockGraph,
      startCoord,
      endCoord,
      overrides: defaultOverrides,
      algorithm: 'dijkstra',
    };

    await (self.onmessage as (e: MessageEvent<WorkerRoutingRequest>) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as WorkerRoutingResponse;
    expect(response.requestId).toBe('req-dijkstra-1');
    expect(response.routeVariants?.length).toBeGreaterThan(0);
  });

  it('computes multi-stop route when waypoints are supplied, skipping WASM', async () => {
    const wasmSpy = vi.spyOn(wasmModule.WasmStreetGraph.prototype, 'find_route_variants');

    await import('./router.worker');

    const waypointCoord: Coordinate = { lat: 48.1375, lng: 11.5755 };
    const request: WorkerRoutingRequest = {
      requestId: 'req-waypoints-1',
      graph: mockGraph,
      startCoord,
      endCoord,
      waypoints: [waypointCoord],
      overrides: defaultOverrides,
      algorithm: 'astar',
    };

    await (self.onmessage as (e: MessageEvent<WorkerRoutingRequest>) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    // WASM should not be called when waypoints are provided
    expect(wasmSpy).not.toHaveBeenCalled();
    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as WorkerRoutingResponse;
    expect(response.requestId).toBe('req-waypoints-1');
    expect(response.routeVariants).toBeDefined();
  });

  it('catches and posts errors when routing execution fails unexpectedly', async () => {
    await import('./router.worker');

    // Passing null data or triggering an error in event
    const invalidRequest = {
      requestId: 'req-err-1',
      graph: null as unknown as StreetGraph,
      startCoord: null as unknown as Coordinate,
      endCoord: null as unknown as Coordinate,
      overrides: defaultOverrides,
    } as WorkerRoutingRequest;

    await (self.onmessage as (e: MessageEvent<WorkerRoutingRequest>) => Promise<void>)(
      new MessageEvent('message', { data: invalidRequest }),
    );

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as WorkerRoutingResponse;
    expect(response.requestId).toBe('req-err-1');
    expect(response.error).toBeDefined();
  });
});
