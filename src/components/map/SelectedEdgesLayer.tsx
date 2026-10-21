import React, { useMemo } from 'react';

import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
import { useEdgeGeoJSON } from '../../hooks/useEdgeGeoJSON';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { useMapContext } from './MapContext';

const SOURCE_ID = 'selected-edges';
const LAYER_ID = 'selected-edges-layer';
const HIGHLIGHT_COLOR = MAP_THEME_TOKENS.brand.teal;

/**
 * Map overlay layer that draws GeoJSON LineStrings for all selectedEdgeIds
 * in a high-visibility highlight color.
 *
 * @returns Null as this component manages MapLibre imperative layers.
 */
export const SelectedEdgesLayer: React.FC = () => {
  const { map, graph, selectedEdgeIds } = useMapContext();
  const geojson = useEdgeGeoJSON(graph, selectedEdgeIds);

  const layer = useMemo<GeoJsonLayerSpec>(
    () => ({
      id: LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': HIGHLIGHT_COLOR,
        'line-width': 4,
        'line-opacity': 0.9,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    }),
    [],
  );

  useGeoJsonLayer({
    map,
    sourceId: SOURCE_ID,
    layer,
    data: geojson,
  });

  return null;
};
