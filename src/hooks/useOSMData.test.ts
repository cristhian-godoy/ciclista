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
});
