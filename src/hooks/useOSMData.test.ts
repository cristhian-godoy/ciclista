import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OSMCacheReader } from '../core/api/OSMCacheReader';
import { OSMNetworkQueue } from '../core/api/OSMNetworkQueue';
import * as dataUsageModule from '../core/storage/dataUsage';
import { useOSMData } from './useOSMData';

vi.mock('../core/api/OSMCacheReader', () => ({
  OSMCacheReader: {
    readChunks: vi.fn(),
  },
}));

vi.mock('../core/api/OSMNetworkQueue', () => ({
  OSMNetworkQueue: {
    addStatusListener: vi.fn(),
    removeStatusListener: vi.fn(),
    addDataListener: vi.fn(),
    removeDataListener: vi.fn(),
    addErrorListener: vi.fn(),
    removeErrorListener: vi.fn(),
    enqueue: vi.fn(),
    setViewport: vi.fn(),
  },
}));

describe('useOSMData Data Saver enforcement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does not enqueue network requests when Data Saver is active', async () => {
    vi.spyOn(dataUsageModule, 'isDataSaverActive').mockReturnValue(true);
    vi.spyOn(OSMCacheReader, 'readChunks').mockResolvedValue({
      graph: { nodes: new Map() },
      loadedChunkIds: ['4813,1157'],
      missingChunkIds: ['4813,1158'],
    });

    const enqueueSpy = vi.spyOn(OSMNetworkQueue, 'enqueue');

    const { result } = renderHook(() =>
      useOSMData({
        startCoord: null,
        endCoord: null,
        setSelectedNode: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.handleMapBoundsChange([48.13, 11.57, 48.14, 11.58], 15);
    });

    // Wait past debounce timer (500ms)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    expect(OSMCacheReader.readChunks).toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('enqueues network requests when Data Saver is inactive', async () => {
    vi.spyOn(dataUsageModule, 'isDataSaverActive').mockReturnValue(false);
    vi.spyOn(OSMCacheReader, 'readChunks').mockResolvedValue({
      graph: { nodes: new Map() },
      loadedChunkIds: ['4813,1157'],
      missingChunkIds: ['4813,1158'],
    });

    const enqueueSpy = vi.spyOn(OSMNetworkQueue, 'enqueue');

    const { result } = renderHook(() =>
      useOSMData({
        startCoord: null,
        endCoord: null,
        setSelectedNode: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.handleMapBoundsChange([48.13, 11.57, 48.14, 11.58], 15);
    });

    // Wait past debounce timer (500ms)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    expect(OSMCacheReader.readChunks).toHaveBeenCalled();
    expect(enqueueSpy).toHaveBeenCalledWith(['4813,1158']);
  });

  it('updates isFetchingOSM when OSMNetworkQueue emits status events', async () => {
    let statusCallback: ((fetching: boolean) => void) | undefined;
    vi.spyOn(OSMNetworkQueue, 'addStatusListener').mockImplementation((cb) => {
      statusCallback = cb;
    });

    const { result } = renderHook(() =>
      useOSMData({
        startCoord: null,
        endCoord: null,
        setSelectedNode: vi.fn(),
      }),
    );

    expect(result.current.isFetchingOSM).toBe(false);

    act(() => {
      statusCallback?.(true);
    });
    expect(result.current.isFetchingOSM).toBe(true);

    act(() => {
      statusCallback?.(false);
    });
    expect(result.current.isFetchingOSM).toBe(false);
  });

  it('merges graph and records loaded bounding boxes when OSMNetworkQueue emits data events', async () => {
    let dataCallback:
      | ((result: { graph: { nodes: Map<string, unknown> }; loadedChunkIds: string[] }) => void)
      | undefined;
    vi.spyOn(OSMNetworkQueue, 'addDataListener').mockImplementation((cb) => {
      dataCallback = cb as unknown as typeof dataCallback;
    });

    const { result } = renderHook(() =>
      useOSMData({
        startCoord: null,
        endCoord: null,
        setSelectedNode: vi.fn(),
      }),
    );

    const emittedGraph = {
      nodes: new Map([
        [
          'node-1',
          {
            node: { id: 'node-1', lat: 48.13, lng: 11.57, tags: {} },
            edges: [],
          },
        ],
      ]),
    };

    act(() => {
      dataCallback?.({
        graph: emittedGraph as never,
        loadedChunkIds: ['4813,1157'],
      });
    });

    expect(result.current.graph).not.toBeNull();
    expect(result.current.loadedBBoxes.length).toBeGreaterThan(0);
  });

  it('ignores map bounds changes when zoom level is below 13', async () => {
    const readChunksSpy = vi.spyOn(OSMCacheReader, 'readChunks');

    const { result } = renderHook(() =>
      useOSMData({
        startCoord: null,
        endCoord: null,
        setSelectedNode: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.handleMapBoundsChange([48.13, 11.57, 48.14, 11.58], 10);
    });

    expect(readChunksSpy).not.toHaveBeenCalled();
  });

  it('triggers auto-fetch when startCoord and endCoord are outside loaded area', async () => {
    let dataCallback:
      | ((result: { graph: { nodes: Map<string, unknown> }; loadedChunkIds: string[] }) => void)
      | undefined;
    vi.spyOn(OSMNetworkQueue, 'addDataListener').mockImplementation((cb) => {
      dataCallback = cb as unknown as typeof dataCallback;
    });

    const readChunksSpy = vi.spyOn(OSMCacheReader, 'readChunks').mockResolvedValue({
      graph: { nodes: new Map() },
      loadedChunkIds: ['4813,1157'],
      missingChunkIds: [],
    });

    let currentStart = { lat: 48.137, lng: 11.575 };
    let currentEnd = { lat: 48.137, lng: 11.575 };

    const { rerender } = renderHook(
      ({ start, end }) =>
        useOSMData({
          startCoord: start,
          endCoord: end,
          setSelectedNode: vi.fn(),
        }),
      { initialProps: { start: currentStart, end: currentEnd } },
    );

    // Initial bbox loaded
    act(() => {
      dataCallback?.({
        graph: { nodes: new Map() } as never,
        loadedChunkIds: ['4813,1157'],
      });
    });

    readChunksSpy.mockClear();

    // Now move startCoord/endCoord outside the loaded area
    currentStart = { lat: 48.2, lng: 11.6 };
    currentEnd = { lat: 48.21, lng: 11.61 };
    act(() => {
      rerender({ start: currentStart, end: currentEnd });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(readChunksSpy).toHaveBeenCalled();
  });
});
