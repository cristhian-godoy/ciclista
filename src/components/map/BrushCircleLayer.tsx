import type * as maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo, useRef } from 'react';

import { createGeoJSONCircle } from '../../core/common/geometry';
import type { Coordinate } from '../../core/common/types';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { useMapContext } from './MapContext';

export const BRUSH_CIRCLE_SOURCE_ID = 'brush-circle-preview';
export const BRUSH_CIRCLE_FILL_LAYER_ID = 'brush-circle-preview-fill';
export const BRUSH_CIRCLE_LINE_LAYER_ID = 'brush-circle-preview-line';

/**
 * High-visibility brand teal color token matching var(--ciclista-color-brand-secondary).
 */
const BRUSH_COLOR = '#14b8a6';

/**
 * MapLibre map overlay rendering a dynamic circular radius preview under the cursor
 * when Radius Brush selection tool is active in Studio mode.
 *
 * @returns Null as this component imperatively manages MapLibre layers and sources.
 */
export const BrushCircleLayer: React.FC = () => {
  const { map, appMode, selectionTool, brushRadius } = useMapContext();
  const lastCoordRef = useRef<Coordinate | null>(null);

  const layers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: BRUSH_CIRCLE_FILL_LAYER_ID,
        type: 'fill',
        source: BRUSH_CIRCLE_SOURCE_ID,
        paint: {
          'fill-color': BRUSH_COLOR,
          'fill-opacity': 0.12,
        },
      },
      {
        id: BRUSH_CIRCLE_LINE_LAYER_ID,
        type: 'line',
        source: BRUSH_CIRCLE_SOURCE_ID,
        paint: {
          'line-color': BRUSH_COLOR,
          'line-width': 1.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.8,
        },
      },
    ],
    [],
  );

  const { setData } = useGeoJsonLayer({
    map,
    sourceId: BRUSH_CIRCLE_SOURCE_ID,
    layers,
  });

  // Update or hide circle preview on mouse movement or mode/tool change
  useEffect(() => {
    if (!map) return;

    const clearPreview = () => {
      lastCoordRef.current = null;
      setData({
        type: 'FeatureCollection',
        features: [],
      });
    };

    const isBrushActive =
      (appMode === 'events' || (appMode as string) === 'studio') && selectionTool === 'brush';

    if (!isBrushActive) {
      clearPreview();
      return;
    }

    const updatePreviewAt = (coord: Coordinate) => {
      const polygon = createGeoJSONCircle(coord, brushRadius);
      setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: polygon,
            properties: {
              radius: brushRadius,
            },
          },
        ],
      });
    };

    // If brush radius changes while cursor is on map, re-render immediately
    if (lastCoordRef.current) {
      updatePreviewAt(lastCoordRef.current);
    }

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const coord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      lastCoordRef.current = coord;
      updatePreviewAt(coord);
    };

    const onMouseLeave = () => {
      clearPreview();
    };

    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMouseLeave);

    const canvas = typeof map.getCanvas === 'function' ? map.getCanvas() : null;
    if (canvas && typeof canvas.addEventListener === 'function') {
      canvas.addEventListener('mouseleave', onMouseLeave);
    }

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseout', onMouseLeave);
      if (canvas && typeof canvas.removeEventListener === 'function') {
        canvas.removeEventListener('mouseleave', onMouseLeave);
      }
      clearPreview();
    };
  }, [map, appMode, selectionTool, brushRadius, setData]);

  return null;
};
