import { renderHook } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextMenuData } from '../components/map/MapContext';
import type { Coordinate } from '../core/common/types';
import type { GraphNode } from '../core/graph/types';
import type { Landmark } from '../core/landmarks/types';
import { useMapInteractionController } from './useMapInteractionController';

describe('useMapInteractionController', () => {
  let mockMap: Partial<maplibregl.Map>;
  let setContextMenuMock: ReturnType<typeof vi.fn>;
  let setDockExpandedMock: ReturnType<typeof vi.fn>;
  let onStartDragMock: ReturnType<typeof vi.fn>;
  let onEndDragMock: ReturnType<typeof vi.fn>;
  let onNodeSelectMock: ReturnType<typeof vi.fn>;
  let openEditPlaceModalMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setContextMenuMock = vi.fn();
    setDockExpandedMock = vi.fn();
    onStartDragMock = vi.fn();
    onEndDragMock = vi.fn();
    onNodeSelectMock = vi.fn();
    openEditPlaceModalMock = vi.fn();

    mockMap = {
      getLayer: vi.fn((id: string) =>
        id === 'landmarks-circle-layer' ||
        id === 'traffic-lights-unclustered' ||
        id === 'traffic-lights-cluster'
          ? ({ id, type: 'circle' } as unknown as maplibregl.StyleLayer)
          : undefined,
      ) as unknown as maplibregl.Map['getLayer'],
      queryRenderedFeatures: vi.fn(() => []),
      easeTo: vi.fn(),
    };
  });

  it('dismisses context menu and sets dock expanded to false on drag start and zoom start', () => {
    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        setContextMenu: setContextMenuMock as unknown as React.Dispatch<
          React.SetStateAction<ContextMenuData>
        >,
        setDockExpanded: setDockExpandedMock as (expanded: boolean) => void,
      }),
    );

    result.current.handleDragStart();
    expect(setContextMenuMock).toHaveBeenCalled();
    expect(setDockExpandedMock).toHaveBeenCalledWith(false);

    setContextMenuMock.mockClear();
    setDockExpandedMock.mockClear();

    result.current.handleZoomStart();
    expect(setContextMenuMock).toHaveBeenCalled();
    expect(setDockExpandedMock).toHaveBeenCalledWith(false);
  });

  it('handles crossing cluster clicks by expanding crossing and focusing map', () => {
    const setManagedClusterIdMock = vi.fn();
    const setManagedNodeIdsMock = vi.fn();
    const setActiveCrossingIdMock = vi.fn();

    (mockMap.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        properties: {
          crossingId: 'crossing-100',
          nodeIds: JSON.stringify(['node-1', 'node-2']),
        },
        geometry: {
          coordinates: [11.575, 48.137],
        },
      },
    ]);

    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        setManagedClusterId: setManagedClusterIdMock,
        setManagedNodeIds: setManagedNodeIdsMock,
        setActiveCrossingId: setActiveCrossingIdMock,
      }),
    );

    result.current.handleClick({
      point: { x: 100, y: 100 },
      lngLat: { lat: 48.137, lng: 11.575 },
    } as unknown as maplibregl.MapMouseEvent);

    expect(setManagedClusterIdMock).toHaveBeenCalledWith('crossing-100');
    expect(setManagedNodeIdsMock).toHaveBeenCalledWith(['node-1', 'node-2']);
    expect(setActiveCrossingIdMock).toHaveBeenCalledWith('crossing-100');
    expect(mockMap.easeTo).toHaveBeenCalledWith({
      center: [11.575, 48.137],
      zoom: 17.5,
    });
  });

  it('places start coordinate when clicking empty space in routing mode', () => {
    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        appMode: 'routing',
        startCoord: null,
        endCoord: null,
        onStartDrag: onStartDragMock as (coord: Coordinate | null) => void,
        onEndDrag: onEndDragMock as (coord: Coordinate | null) => void,
        onNodeSelect: onNodeSelectMock as (node: GraphNode | null) => void,
        setContextMenu: setContextMenuMock as unknown as React.Dispatch<
          React.SetStateAction<ContextMenuData>
        >,
      }),
    );

    result.current.handleClick({
      point: { x: 100, y: 150 },
      lngLat: { lat: 48.13, lng: 11.57 },
    } as unknown as maplibregl.MapMouseEvent);

    expect(onStartDragMock).toHaveBeenCalledWith({ lat: 48.13, lng: 11.57 });
    expect(onEndDragMock).toHaveBeenCalledWith(null);
  });

  it('opens edit modal when clicking place in places mode', () => {
    const samplePlace: Landmark = {
      id: 'p-1',
      name: 'Cafe',
      category: 'other',
      lat: 48.135,
      lng: 11.575,
      createdAt: 1000,
      updatedAt: 1000,
    };

    (mockMap.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockImplementation(
      (_bbox, opts) => {
        if (opts?.layers?.includes('landmarks-circle-layer')) {
          return [{ properties: { id: 'p-1' } }];
        }
        return [];
      },
    );

    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        appMode: 'places',
        places: [samplePlace],
        openEditPlaceModal: openEditPlaceModalMock as (place: Landmark) => void,
        setContextMenu: setContextMenuMock as unknown as React.Dispatch<
          React.SetStateAction<ContextMenuData>
        >,
      }),
    );

    result.current.handleClick({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.135, lng: 11.575 },
    } as unknown as maplibregl.MapMouseEvent);

    expect(openEditPlaceModalMock).toHaveBeenCalledWith(samplePlace);
  });
});
