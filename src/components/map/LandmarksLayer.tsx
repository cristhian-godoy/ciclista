import type maplibregl from 'maplibre-gl';
import React, { useEffect } from 'react';

import type { Coordinate } from '../../core/common/types';
import { useMapContext } from './MapContext';

const SOURCE_ID = 'landmarks-source';
const GLOW_LAYER_ID = 'landmarks-glow-layer';
const CIRCLE_LAYER_ID = 'landmarks-circle-layer';
const LABEL_LAYER_ID = 'landmarks-label-layer';

const BRAND_COLOR = '#38bdf8'; // Sky blue brand token
const GLOW_COLOR = '#0284c7';

/**
 * Map overlay layer rendering registered favorite places and landmarks as
 * distinct interactive points with category glows and labels.
 *
 * @returns Null as this component orchestrates MapLibre imperative layers.
 */
export const LandmarksLayer: React.FC = () => {
  const { map, landmarks, onStartDrag, onEndDrag, appMode, openEditLandmarkModal } =
    useMapContext();

  // Register GeoJSON source and layers
  useEffect(() => {
    if (!map) return;

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // Outer glow circle
    if (!map.getLayer(GLOW_LAYER_ID)) {
      map.addLayer({
        id: GLOW_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 11,
          'circle-color': GLOW_COLOR,
          'circle-opacity': 0.35,
          'circle-blur': 0.6,
        },
      });
    }

    // Inner distinct anchor circle
    if (!map.getLayer(CIRCLE_LAYER_ID)) {
      map.addLayer({
        id: CIRCLE_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': BRAND_COLOR,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });
    }

    // Text label
    if (!map.getLayer(LABEL_LAYER_ID)) {
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#0f172a',
          'text-halo-width': 1.5,
        },
      });
    }

    return () => {
      if (map.getLayer(LABEL_LAYER_ID)) {
        map.removeLayer(LABEL_LAYER_ID);
      }
      if (map.getLayer(CIRCLE_LAYER_ID)) {
        map.removeLayer(CIRCLE_LAYER_ID);
      }
      if (map.getLayer(GLOW_LAYER_ID)) {
        map.removeLayer(GLOW_LAYER_ID);
      }
      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
  }, [map]);

  // Synchronize landmarks state to GeoJSON source data
  useEffect(() => {
    if (!map) return;

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source || typeof source.setData !== 'function') return;

    const features: GeoJSON.Feature<GeoJSON.Point>[] = (landmarks || []).map((landmark) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [landmark.lng, landmark.lat],
      },
      properties: {
        id: landmark.id,
        name: landmark.name,
        category: landmark.category,
        description: landmark.description ?? '',
        lat: landmark.lat,
        lng: landmark.lng,
      },
    }));

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [map, landmarks]);

  // Click and contextmenu handlers on landmark layers
  useEffect(() => {
    if (!map) return;

    const handleClick = (e: maplibregl.MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const feat = e.features?.[0];
      if (!feat || !feat.properties) return;

      const landmarkId = String(feat.properties.id);
      const target = (landmarks || []).find((lm) => lm.id === landmarkId);

      // In landmarks mode: clicking existing landmark opens edit modal rather than routing pins
      if (appMode === 'landmarks') {
        if (target) {
          openEditLandmarkModal?.(target);
        }
        return;
      }

      const lat = Number(feat.properties.lat);
      const lng = Number(feat.properties.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const coord: Coordinate = { lat, lng };
        if (e.originalEvent?.shiftKey) {
          onEndDrag?.(coord);
        } else {
          onStartDrag?.(coord);
        }
      }
    };

    const handleContextMenu = (e: maplibregl.MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const feat = e.features?.[0];
      if (!feat || !feat.properties) return;
      e.originalEvent?.preventDefault?.();

      const landmarkId = String(feat.properties.id);
      const target = (landmarks || []).find((lm) => lm.id === landmarkId);
      if (target) {
        openEditLandmarkModal?.(target);
      }
    };

    map.on('click', CIRCLE_LAYER_ID, handleClick as (...args: unknown[]) => void);
    map.on('contextmenu', CIRCLE_LAYER_ID, handleContextMenu as (...args: unknown[]) => void);
    map.on('contextmenu', LABEL_LAYER_ID, handleContextMenu as (...args: unknown[]) => void);

    return () => {
      map.off('click', CIRCLE_LAYER_ID, handleClick as (...args: unknown[]) => void);
      map.off('contextmenu', CIRCLE_LAYER_ID, handleContextMenu as (...args: unknown[]) => void);
      map.off('contextmenu', LABEL_LAYER_ID, handleContextMenu as (...args: unknown[]) => void);
    };
  }, [map, landmarks, appMode, onStartDrag, onEndDrag, openEditLandmarkModal]);

  return null;
};
