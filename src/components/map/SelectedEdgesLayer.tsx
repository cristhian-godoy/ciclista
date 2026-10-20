import type * as maplibregl from 'maplibre-gl';
import React, { useEffect } from 'react';

import { useEdgeGeoJSON } from '../../hooks/useEdgeGeoJSON';
import { useMapContext } from './MapContext';

const SOURCE_ID = 'selected-edges';
const LAYER_ID = 'selected-edges-layer';
const HIGHLIGHT_COLOR = '#14b8a6';

/**
 * Map overlay layer that draws GeoJSON LineStrings for all selectedEdgeIds
 * in a high-visibility highlight color.
 *
 * @returns Null as this component manages MapLibre imperative layers.
 */
export const SelectedEdgesLayer: React.FC = () => {
  const { map, graph, selectedEdgeIds } = useMapContext();
  const geojson = useEdgeGeoJSON(graph, selectedEdgeIds);

  // Register MapLibre source and line layer
  useEffect(() => {
    if (!map) return;

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
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
      });
    }

    return () => {
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }
      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
  }, [map]);

  // Synchronize selectedEdgeIds into the GeoJSON layer source
  useEffect(() => {
    if (!map) return;

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source || typeof source.setData !== 'function') return;

    source.setData(geojson);
  }, [map, geojson]);

  return null;
};
