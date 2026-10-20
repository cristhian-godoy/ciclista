import type * as maplibregl from 'maplibre-gl';
import React, { useEffect } from 'react';

import { useMapContext } from './MapContext';

/**
 * Map overlay layer component that renders bounding box (BBox) boundaries
 * for currently loaded OSM network regions as polygons.
 *
 * @returns Null as this component imperatively manages MapLibre layers and sources.
 */
export const BBoxBoundaryLayer: React.FC = () => {
  const { map, loadedBBoxes, theme } = useMapContext();

  // Add source and line layer on mount/map change
  useEffect(() => {
    if (!map) return;
    if (!map.getSource('loaded-bbox')) {
      map.addSource('loaded-bbox', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer('loaded-bbox-layer')) {
      map.addLayer({
        id: 'loaded-bbox-layer',
        type: 'line',
        source: 'loaded-bbox',
        paint: {
          'line-color': theme === 'dark' ? '#38bdf8' : '#0284c7',
          'line-width': 1.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.6,
        },
      });
    }

    return () => {
      if (map) {
        if (map.getLayer('loaded-bbox-layer')) {
          map.removeLayer('loaded-bbox-layer');
        }
        if (map.getSource('loaded-bbox')) {
          map.removeSource('loaded-bbox');
        }
      }
    };
  }, [map, theme]);

  // Sync theme updates to layer paint property
  useEffect(() => {
    if (!map || !map.getLayer('loaded-bbox-layer')) return;
    map.setPaintProperty(
      'loaded-bbox-layer',
      'line-color',
      theme === 'dark' ? '#38bdf8' : '#0284c7',
    );
  }, [map, theme]);

  // Sync loadedBBoxes into the source
  useEffect(() => {
    if (!map) return;
    const bboxSource = map.getSource('loaded-bbox') as maplibregl.GeoJSONSource;
    if (!bboxSource) return;

    if (loadedBBoxes && loadedBBoxes.length > 0) {
      const features = loadedBBoxes.map((bbox) => {
        const [minLat, minLng, maxLat, maxLng] = bbox;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat],
              ],
            ],
          },
          properties: {},
        };
      });
      bboxSource.setData({
        type: 'FeatureCollection',
        features,
      });
    } else {
      bboxSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }, [map, loadedBBoxes]);

  return null;
};
