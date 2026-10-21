import { renderHook } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type GeoJsonLayerSpec, useGeoJsonLayer } from './useGeoJsonLayer';

describe('useGeoJsonLayer', () => {
  let mockMap: Partial<maplibregl.Map>;
  let mockSource: { setData: ReturnType<typeof vi.fn> };
  let addSourceMock: ReturnType<typeof vi.fn>;
  let addLayerMock: ReturnType<typeof vi.fn>;
  let removeLayerMock: ReturnType<typeof vi.fn>;
  let removeSourceMock: ReturnType<typeof vi.fn>;
  let setPaintPropertyMock: ReturnType<typeof vi.fn>;
  let setLayoutPropertyMock: ReturnType<typeof vi.fn>;

  const mockLayerSpec: GeoJsonLayerSpec = {
    id: 'test-layer',
    type: 'line',
    source: 'test-source',
    paint: { 'line-color': '#ff0000', 'line-width': 2 },
    layout: { 'line-cap': 'round' },
  };

  const sampleGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [10, 20] },
        properties: { id: 1 },
      },
    ],
  };

  beforeEach(() => {
    mockSource = {
      setData: vi.fn(),
    };
    addSourceMock = vi.fn();
    addLayerMock = vi.fn();
    removeLayerMock = vi.fn();
    removeSourceMock = vi.fn();
    setPaintPropertyMock = vi.fn();
    setLayoutPropertyMock = vi.fn();

    mockMap = {
      getSource: vi.fn((id: string) => {
        if (id === 'test-source') return mockSource as unknown as maplibregl.GeoJSONSource;
        return undefined;
      }),
      getLayer: vi.fn((id: string) => {
        if (id === 'test-layer') return mockLayerSpec as unknown as maplibregl.StyleLayer;
        return undefined;
      }),
      addSource: addSourceMock,
      addLayer: addLayerMock,
      removeLayer: removeLayerMock,
      removeSource: removeSourceMock,
      setPaintProperty: setPaintPropertyMock,
      setLayoutProperty: setLayoutPropertyMock,
    } as unknown as Partial<maplibregl.Map>;
  });

  it('registers source and layer on mount and synchronizes data', () => {
    (mockMap.getSource as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);
    (mockMap.getLayer as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

    const { result } = renderHook(() =>
      useGeoJsonLayer({
        map: mockMap as maplibregl.Map,
        sourceId: 'test-source',
        layer: mockLayerSpec,
        data: sampleGeoJSON,
      }),
    );

    expect(addSourceMock).toHaveBeenCalledWith('test-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    expect(addLayerMock).toHaveBeenCalledWith(mockLayerSpec);
    expect(mockSource.setData).toHaveBeenCalledWith(sampleGeoJSON);
    expect(result.current.getSource()).toBe(mockSource);
  });

  it('cleans up layers and source on unmount', () => {
    const { unmount } = renderHook(() =>
      useGeoJsonLayer({
        map: mockMap as maplibregl.Map,
        sourceId: 'test-source',
        layers: [mockLayerSpec],
      }),
    );

    unmount();

    expect(removeLayerMock).toHaveBeenCalledWith('test-layer');
    expect(removeSourceMock).toHaveBeenCalledWith('test-source');
  });

  it('updates paint and layout properties when specs change', () => {
    const { rerender } = renderHook(
      (props: { color: string }) =>
        useGeoJsonLayer({
          map: mockMap as maplibregl.Map,
          sourceId: 'test-source',
          layer: {
            ...mockLayerSpec,
            paint: { 'line-color': props.color, 'line-width': 2 },
          },
        }),
      { initialProps: { color: '#ff0000' } },
    );

    expect(setPaintPropertyMock).toHaveBeenCalledWith('test-layer', 'line-color', '#ff0000');
    expect(setPaintPropertyMock).toHaveBeenCalledWith('test-layer', 'line-width', 2);

    rerender({ color: '#00ff00' });

    expect(setPaintPropertyMock).toHaveBeenCalledWith('test-layer', 'line-color', '#00ff00');
  });

  it('imperatively updates data via returned setData callback', () => {
    const { result } = renderHook(() =>
      useGeoJsonLayer({
        map: mockMap as maplibregl.Map,
        sourceId: 'test-source',
        layer: mockLayerSpec,
      }),
    );

    result.current.setData(sampleGeoJSON);
    expect(mockSource.setData).toHaveBeenCalledWith(sampleGeoJSON);
  });

  it('does not tear down source when layers change reference', () => {
    const { rerender } = renderHook(
      (props: { width: number }) =>
        useGeoJsonLayer({
          map: mockMap as maplibregl.Map,
          sourceId: 'test-source',
          layer: {
            ...mockLayerSpec,
            paint: { 'line-color': '#ff0000', 'line-width': props.width },
          },
        }),
      { initialProps: { width: 2 } },
    );

    expect(removeSourceMock).not.toHaveBeenCalled();

    rerender({ width: 4 });

    expect(removeSourceMock).not.toHaveBeenCalled();
    expect(setPaintPropertyMock).toHaveBeenCalledWith('test-layer', 'line-width', 4);
  });
});
