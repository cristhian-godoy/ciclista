import React, { useMemo } from 'react';

import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { useMapContext } from './MapContext';

const SOURCE_ID = 'landmarks-source';
const GLOW_LAYER_ID = 'landmarks-glow-layer';
const CIRCLE_LAYER_ID = 'landmarks-circle-layer';
const LABEL_LAYER_ID = 'landmarks-label-layer';

const BRAND_COLOR = MAP_THEME_TOKENS.brand.sky; // Sky blue brand token
const GLOW_COLOR = MAP_THEME_TOKENS.brand.skyGlow;

/**
 * Map overlay layer rendering registered places as distinct interactive
 * points with category glows and labels.
 *
 * @returns Null as this component orchestrates MapLibre declarative layers.
 */
export const PlacesLayer: React.FC = () => {
  const { map, places, landmarks } = useMapContext();

  const currentPlaces = useMemo(() => places ?? landmarks ?? [], [places, landmarks]);

  const layers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      // Outer glow circle
      {
        id: GLOW_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 11,
          'circle-color': GLOW_COLOR,
          'circle-opacity': 0.35,
          'circle-blur': 0.6,
        },
      },
      // Inner distinct anchor circle
      {
        id: CIRCLE_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': BRAND_COLOR,
          'circle-stroke-width': 2,
          'circle-stroke-color': MAP_THEME_TOKENS.overlay.white,
          'circle-opacity': 0.95,
        },
      },
      // Text label
      {
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
          'text-color': MAP_THEME_TOKENS.overlay.white,
          'text-halo-color': MAP_THEME_TOKENS.overlay.darkNavy,
          'text-halo-width': 1.5,
        },
      },
    ],
    [],
  );

  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const features: GeoJSON.Feature<GeoJSON.Point>[] = currentPlaces.map((place) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [place.lng, place.lat],
      },
      properties: {
        id: place.id,
        name: place.name,
        category: place.category,
        description: place.description ?? '',
        lat: place.lat,
        lng: place.lng,
      },
    }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [currentPlaces]);

  useGeoJsonLayer({
    map,
    sourceId: SOURCE_ID,
    layers,
    data,
  });

  return null;
};

export { PlacesLayer as LandmarksLayer };
