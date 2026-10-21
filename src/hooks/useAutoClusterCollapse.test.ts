import { renderHook } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StreetGraph } from '../core/graph/types';
import { useAutoClusterCollapse } from './useAutoClusterCollapse';

describe('useAutoClusterCollapse', () => {
  let mockMap: Partial<maplibregl.Map>;
  let onMock: ReturnType<typeof vi.fn>;
  let offMock: ReturnType<typeof vi.fn>;
  let setManagedClusterIdMock: ReturnType<typeof vi.fn>;
  let setManagedNodeIdsMock: ReturnType<typeof vi.fn>;

  const nodes = new Map();
  nodes.set('node-1', {
    node: { id: 'node-1', lat: 48.14, lng: 11.58, tags: {} },
    edges: [],
  });
  const mockGraph = { nodes } as unknown as StreetGraph;

  beforeEach(() => {
    onMock = vi.fn();
    offMock = vi.fn();
    setManagedClusterIdMock = vi.fn();
    setManagedNodeIdsMock = vi.fn();

    mockMap = {
      on: onMock,
      off: offMock,
      getZoom: vi.fn(() => 17),
      getCenter: vi.fn(() => ({ lat: 48.14, lng: 11.58 }) as unknown as maplibregl.LngLat),
    };
  });

  it('registers moveend listener when cluster is managed and cleans up on unmount', () => {
    const { unmount } = renderHook(() =>
      useAutoClusterCollapse({
        map: mockMap as maplibregl.Map,
        managedClusterId: 'cluster-1',
        managedNodeIds: ['node-1'],
        graph: mockGraph,
        setManagedClusterId: setManagedClusterIdMock,
        setManagedNodeIds: setManagedNodeIdsMock,
      }),
    );

    expect(onMock).toHaveBeenCalledWith('moveend', expect.any(Function));

    unmount();
    expect(offMock).toHaveBeenCalledWith('moveend', expect.any(Function));
  });

  it('does not register moveend listener when managedClusterId is null', () => {
    renderHook(() =>
      useAutoClusterCollapse({
        map: mockMap as maplibregl.Map,
        managedClusterId: null,
        managedNodeIds: [],
        graph: mockGraph,
        setManagedClusterId: setManagedClusterIdMock,
        setManagedNodeIds: setManagedNodeIdsMock,
      }),
    );

    expect(onMock).not.toHaveBeenCalled();
  });

  it('collapses cluster on moveend if zoom is below 15.5', () => {
    mockMap.getZoom = vi.fn(() => 14);

    renderHook(() =>
      useAutoClusterCollapse({
        map: mockMap as maplibregl.Map,
        managedClusterId: 'cluster-1',
        managedNodeIds: ['node-1'],
        graph: mockGraph,
        setManagedClusterId: setManagedClusterIdMock,
        setManagedNodeIds: setManagedNodeIdsMock,
      }),
    );

    const moveendHandler = onMock.mock.calls.find((call) => call[0] === 'moveend')?.[1];
    expect(moveendHandler).toBeDefined();

    moveendHandler();

    expect(setManagedClusterIdMock).toHaveBeenCalledWith(null);
    expect(setManagedNodeIdsMock).toHaveBeenCalledWith([]);
  });

  it('collapses cluster on moveend if center pans farther than 450m away', () => {
    mockMap.getZoom = vi.fn(() => 17);
    mockMap.getCenter = vi.fn(() => ({ lat: 48.2, lng: 11.58 }) as unknown as maplibregl.LngLat);

    renderHook(() =>
      useAutoClusterCollapse({
        map: mockMap as maplibregl.Map,
        managedClusterId: 'cluster-1',
        managedNodeIds: ['node-1'],
        graph: mockGraph,
        setManagedClusterId: setManagedClusterIdMock,
        setManagedNodeIds: setManagedNodeIdsMock,
      }),
    );

    const moveendHandler = onMock.mock.calls.find((call) => call[0] === 'moveend')?.[1];
    expect(moveendHandler).toBeDefined();

    moveendHandler();

    expect(setManagedClusterIdMock).toHaveBeenCalledWith(null);
    expect(setManagedNodeIdsMock).toHaveBeenCalledWith([]);
  });

  it('does not collapse cluster on moveend if camera is within proximity and high zoom', () => {
    mockMap.getZoom = vi.fn(() => 17);
    mockMap.getCenter = vi.fn(
      () => ({ lat: 48.1405, lng: 11.5805 }) as unknown as maplibregl.LngLat,
    );

    renderHook(() =>
      useAutoClusterCollapse({
        map: mockMap as maplibregl.Map,
        managedClusterId: 'cluster-1',
        managedNodeIds: ['node-1'],
        graph: mockGraph,
        setManagedClusterId: setManagedClusterIdMock,
        setManagedNodeIds: setManagedNodeIdsMock,
      }),
    );

    const moveendHandler = onMock.mock.calls.find((call) => call[0] === 'moveend')?.[1];
    expect(moveendHandler).toBeDefined();

    moveendHandler();

    expect(setManagedClusterIdMock).not.toHaveBeenCalled();
    expect(setManagedNodeIdsMock).not.toHaveBeenCalled();
  });
});
