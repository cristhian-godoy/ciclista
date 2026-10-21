import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CONFIG } from '../common/constants';
import * as wasmModule from '../wasm';

describe('parser.worker unit tests', () => {
  const originalPostMessage = globalThis.postMessage;
  const originalCaches = globalThis.caches;
  let postMessageMock: ReturnType<typeof vi.fn>;

  const sampleOsmData = {
    elements: [
      { type: 'node', id: 1, lat: 48.137, lon: 11.575, tags: {} },
      { type: 'node', id: 2, lat: 48.138, lon: 11.576, tags: {} },
      { type: 'way', id: 10, nodes: [1, 2], tags: { highway: 'cycleway' } },
    ],
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
    if (originalCaches !== undefined) {
      globalThis.caches = originalCaches;
    }
  });

  it('parses rawData via WASM engine when initialized', async () => {
    const mockToEntries = vi.fn().mockReturnValue(JSON.stringify([['1', { node: {}, edges: [] }]]));
    vi.spyOn(wasmModule, 'ensureWasmInitialized').mockResolvedValue(true);
    vi.spyOn(wasmModule.WasmEngine, 'parse_graph').mockReturnValue({
      to_entries_json: mockToEntries,
    } as unknown as wasmModule.WasmStreetGraph);

    await import('./parser.worker');

    const request = {
      requestId: 'parse-wasm-1',
      rawData: sampleOsmData,
    };

    await (self.onmessage as (e: MessageEvent) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as {
      requestId: string;
      serializedNodes: string;
      byteLength: number;
    };
    expect(response).toBeDefined();
    expect(response.requestId).toBe('parse-wasm-1');
    expect(response.byteLength).toBe(0);
    expect(response.serializedNodes).toContain('1');
  });

  it('falls back to TypeScript parser when WASM parsing fails', async () => {
    vi.spyOn(wasmModule, 'ensureWasmInitialized').mockResolvedValue(true);
    vi.spyOn(wasmModule.WasmEngine, 'parse_graph').mockImplementation(() => {
      throw new Error('WASM parsing crash');
    });

    await import('./parser.worker');

    const request = {
      requestId: 'parse-fallback-1',
      rawData: sampleOsmData,
    };

    await (self.onmessage as (e: MessageEvent) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as {
      requestId: string;
      serializedNodes: string;
      byteLength: number;
    };
    expect(response).toBeDefined();
    expect(response.requestId).toBe('parse-fallback-1');
    expect(response.byteLength).toBe(0);
    const entries = JSON.parse(response.serializedNodes) as [string, unknown][];
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('retrieves and parses payload from CacheStorage via cacheUrl with Content-Length', async () => {
    vi.spyOn(wasmModule, 'ensureWasmInitialized').mockResolvedValue(false);

    const jsonPayload = JSON.stringify(sampleOsmData);
    const matchMock = vi.fn().mockResolvedValue({
      headers: new Headers({ 'Content-Length': '1024' }),
      text: vi.fn().mockResolvedValue(jsonPayload),
    });
    const openMock = vi.fn().mockResolvedValue({
      match: matchMock,
    });

    globalThis.caches = {
      open: openMock,
    } as unknown as CacheStorage;

    await import('./parser.worker');

    const request = {
      requestId: 'parse-cache-1',
      cacheUrl: 'https://overpass.kumi.systems/api/interpreter?bbox=1,2,3,4',
    };

    await (self.onmessage as (e: MessageEvent) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    expect(openMock).toHaveBeenCalledWith(API_CONFIG.CACHE_NAME);
    expect(matchMock).toHaveBeenCalled();
    expect(postMessageMock).toHaveBeenCalledTimes(1);

    const response = postMessageMock.mock.calls[0]?.[0] as {
      requestId: string;
      serializedNodes: string;
      byteLength: number;
    };
    expect(response.requestId).toBe('parse-cache-1');
    expect(response.byteLength).toBe(1024);
    expect(response.serializedNodes).toBeDefined();
  });

  it('computes byteLength from text length when Content-Length header is omitted', async () => {
    vi.spyOn(wasmModule, 'ensureWasmInitialized').mockResolvedValue(false);

    const jsonPayload = JSON.stringify(sampleOsmData);
    const matchMock = vi.fn().mockResolvedValue({
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(jsonPayload),
    });
    const openMock = vi.fn().mockResolvedValue({
      match: matchMock,
    });

    globalThis.caches = {
      open: openMock,
    } as unknown as CacheStorage;

    await import('./parser.worker');

    const request = {
      requestId: 'parse-cache-no-header',
      cacheUrl: 'https://overpass.kumi.systems/api/interpreter?bbox=1,2,3,4',
    };

    await (self.onmessage as (e: MessageEvent) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as {
      requestId: string;
      byteLength: number;
    };
    expect(response.requestId).toBe('parse-cache-no-header');
    expect(response.byteLength).toBe(jsonPayload.length);
  });

  it('catches and posts errors when cached entry is missing', async () => {
    const matchMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn().mockResolvedValue({
      match: matchMock,
    });

    globalThis.caches = {
      open: openMock,
    } as unknown as CacheStorage;

    await import('./parser.worker');

    const request = {
      requestId: 'parse-cache-miss',
      cacheUrl: 'https://overpass.kumi.systems/api/interpreter?missing=true',
    };

    await (self.onmessage as (e: MessageEvent) => Promise<void>)(
      new MessageEvent('message', { data: request }),
    );

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const response = postMessageMock.mock.calls[0]?.[0] as {
      requestId: string;
      error?: string;
    };
    expect(response.requestId).toBe('parse-cache-miss');
    expect(response.error).toContain('No cached response found for cacheUrl');
  });
});
