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

  it('suppresses context menu on right click in events mode when not on edge', () => {
    const preventDefaultMock = vi.fn();

    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        appMode: 'events',
        setContextMenu: setContextMenuMock as unknown as React.Dispatch<
          React.SetStateAction<ContextMenuData>
        >,
      }),
    );

    result.current.handleContextMenu({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.135, lng: 11.575 },
      originalEvent: { preventDefault: preventDefaultMock },
    } as unknown as maplibregl.MapMouseEvent);

    expect(preventDefaultMock).toHaveBeenCalled();
    expect(setContextMenuMock).not.toHaveBeenCalled();
  });

  it('suppresses context menu on right click in edit mode when no crossing cluster is clicked', () => {
    const preventDefaultMock = vi.fn();

    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        appMode: 'edit',
        setContextMenu: setContextMenuMock as unknown as React.Dispatch<
          React.SetStateAction<ContextMenuData>
        >,
      }),
    );

    result.current.handleContextMenu({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.135, lng: 11.575 },
      originalEvent: { preventDefault: preventDefaultMock },
    } as unknown as maplibregl.MapMouseEvent);

    expect(preventDefaultMock).toHaveBeenCalled();
    expect(setContextMenuMock).not.toHaveBeenCalled();
  });

  it('opens context menu on right click in edit mode when a crossing cluster is clicked', () => {
    (mockMap.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockImplementation(
      (_point, opts) => {
        if (opts?.layers?.includes('traffic-lights-cluster')) {
          return [
            {
              properties: {
                crossingId: 'crossing-99',
                nodeIds: JSON.stringify(['n-1']),
              },
            },
          ];
        }
        return [];
      },
    );

    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        appMode: 'edit',
        setContextMenu: setContextMenuMock as unknown as React.Dispatch<
          React.SetStateAction<ContextMenuData>
        >,
      }),
    );

    result.current.handleContextMenu({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.135, lng: 11.575 },
      originalEvent: { preventDefault: vi.fn() },
    } as unknown as maplibregl.MapMouseEvent);

    expect(setContextMenuMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        crossingId: 'crossing-99',
      }),
    );
  });

  it('does not query traffic light clusters on right-click in routing mode', () => {
    (mockMap.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockClear();

    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        appMode: 'routing',
        setContextMenu: setContextMenuMock as unknown as React.Dispatch<
          React.SetStateAction<ContextMenuData>
        >,
      }),
    );

    result.current.handleContextMenu({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.135, lng: 11.575 },
      originalEvent: { preventDefault: vi.fn() },
    } as unknown as maplibregl.MapMouseEvent);

    expect(mockMap.queryRenderedFeatures).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ layers: ['traffic-lights-cluster'] }),
    );
    expect(setContextMenuMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        crossingId: null,
        nodeIds: null,
      }),
    );
  });

  it('captures click during isPlacingStop mode to add a new intermediate waypoint', () => {
    const onAddWaypointMock = vi.fn();
    const setIsPlacingStopMock = vi.fn();
    const setPlacingStopIndexMock = vi.fn();

    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        appMode: 'routing',
        isPlacingStop: true,
        setIsPlacingStop: setIsPlacingStopMock,
        setPlacingStopIndex: setPlacingStopIndexMock,
        onAddWaypoint: onAddWaypointMock,
        setContextMenu: setContextMenuMock as unknown as React.Dispatch<
          React.SetStateAction<ContextMenuData>
        >,
      }),
    );

    result.current.handleClick({
      point: { x: 75, y: 75 },
      lngLat: { lat: 48.14, lng: 11.58 },
    } as unknown as maplibregl.MapMouseEvent);

    expect(setIsPlacingStopMock).toHaveBeenCalledWith(false);
    expect(setPlacingStopIndexMock).toHaveBeenCalledWith(null);
    expect(onAddWaypointMock).toHaveBeenCalledWith({ lat: 48.14, lng: 11.58 });
  });

  it('captures click during isPlacingStop mode to reposition an existing waypoint', () => {
    const onUpdateWaypointMock = vi.fn();
    const setIsPlacingStopMock = vi.fn();
    const setPlacingStopIndexMock = vi.fn();

    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        appMode: 'routing',
        isPlacingStop: true,
        placingStopIndex: 1,
        setIsPlacingStop: setIsPlacingStopMock,
        setPlacingStopIndex: setPlacingStopIndexMock,
        onUpdateWaypoint: onUpdateWaypointMock,
        setContextMenu: setContextMenuMock as unknown as React.Dispatch<
          React.SetStateAction<ContextMenuData>
        >,
      }),
    );

    result.current.handleClick({
      point: { x: 75, y: 75 },
      lngLat: { lat: 48.145, lng: 11.585 },
    } as unknown as maplibregl.MapMouseEvent);

    expect(setIsPlacingStopMock).toHaveBeenCalledWith(false);
    expect(setPlacingStopIndexMock).toHaveBeenCalledWith(null);
    expect(onUpdateWaypointMock).toHaveBeenCalledWith(1, { lat: 48.145, lng: 11.585 });
  });
});
