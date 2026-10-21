import React, { useMemo } from 'react';

import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { useMapContext } from './MapContext';

/**
 * Map overlay layer component that renders bounding box (BBox) boundaries
 * for currently loaded OSM network regions as polygons.
 *
 * @returns Null as this component imperatively manages MapLibre layers and sources.
 */
export const BBoxBoundaryLayer: React.FC = () => {
  const { map, loadedBBoxes, theme } = useMapContext();
  const lineColor = theme === 'dark' ? MAP_THEME_TOKENS.brand.sky : MAP_THEME_TOKENS.brand.skyGlow;

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!loadedBBoxes || loadedBBoxes.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
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
    return { type: 'FeatureCollection', features };
  }, [loadedBBoxes]);

  const layer = useMemo<GeoJsonLayerSpec>(
    () => ({
      id: 'loaded-bbox-layer',
      type: 'line',
      source: 'loaded-bbox',
      paint: {
        'line-color': lineColor,
        'line-width': 1.5,
        'line-dasharray': [2, 2],
        'line-opacity': 0.6,
      },
    }),
    [lineColor],
  );

  useGeoJsonLayer({
    map,
    sourceId: 'loaded-bbox',
    layer,
    data: geojson,
  });

  return null;
};
