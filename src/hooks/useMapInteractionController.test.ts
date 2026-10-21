import { renderHook } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMapInteractionController } from './useMapInteractionController';

describe('useMapInteractionController', () => {
  let mockMap: Partial<maplibregl.Map>;
  let setContextMenuMock: ReturnType<typeof vi.fn>;
  let setDockExpandedMock: ReturnType<typeof vi.fn>;
  let onStartDragMock: ReturnType<typeof vi.fn>;
  let onEndDragMock: ReturnType<typeof vi.fn>;
  let onNodeSelectMock: ReturnType<typeof vi.fn>;
  let openCreatePlaceModalMock: ReturnType<typeof vi.fn>;
  let openEditPlaceModalMock: ReturnType<typeof vi.fn>;
  let setIsPlacingPlaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setContextMenuMock = vi.fn();
    setDockExpandedMock = vi.fn();
    onStartDragMock = vi.fn();
    onEndDragMock = vi.fn();
    onNodeSelectMock = vi.fn();
    openCreatePlaceModalMock = vi.fn();
    openEditPlaceModalMock = vi.fn();
    setIsPlacingPlaceMock = vi.fn();

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
        setContextMenu: setContextMenuMock,
        setDockExpanded: setDockExpandedMock,
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

  it('handles click in pin placement mode by opening create modal and exiting placement', () => {
    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        isPlacingPlace: true,
        setIsPlacingPlace: setIsPlacingPlaceMock,
        openCreatePlaceModal: openCreatePlaceModalMock,
        setContextMenu: setContextMenuMock,
      }),
    );

    result.current.handleClick({
      point: { x: 100, y: 150 },
      lngLat: { lat: 48.13, lng: 11.57 },
    } as unknown as maplibregl.MapMouseEvent);

    expect(setIsPlacingPlaceMock).toHaveBeenCalledWith(false);
    expect(openCreatePlaceModalMock).toHaveBeenCalledWith({ lat: 48.13, lng: 11.57 });
  });

  it('places start coordinate when clicking empty space in routing mode', () => {
    const { result } = renderHook(() =>
      useMapInteractionController({
        map: mockMap as maplibregl.Map,
        appMode: 'routing',
        startCoord: null,
        endCoord: null,
        onStartDrag: onStartDragMock,
        onEndDrag: onEndDragMock,
        onNodeSelect: onNodeSelectMock,
        setContextMenu: setContextMenuMock,
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
    const samplePlace = {
      id: 'p-1',
      name: 'Cafe',
      category: 'amenity',
      lat: 48.135,
      lng: 11.575,
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
        openEditPlaceModal: openEditPlaceModalMock,
        setContextMenu: setContextMenuMock,
      }),
    );

    result.current.handleClick({
      point: { x: 50, y: 50 },
      lngLat: { lat: 48.135, lng: 11.575 },
    } as unknown as maplibregl.MapMouseEvent);

    expect(openEditPlaceModalMock).toHaveBeenCalledWith(samplePlace);
  });
});
