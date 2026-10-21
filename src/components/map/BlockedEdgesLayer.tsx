import React, { useMemo } from 'react';

import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
import { type EdgeFeatureEntry, useEdgeGeoJSON } from '../../hooks/useEdgeGeoJSON';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { useMapContext } from './MapContext';

const SOURCE_ID = 'blocked-edges';
const LAYER_ID = 'blocked-edges-layer';
const BARRICADE_COLOR = MAP_THEME_TOKENS.brand.rose;

/**
 * Map overlay layer that draws GeoJSON LineStrings for all edges belonging
 * to active road_blockage events in warning barricade dashed style.
 *
 * @returns Null as this component manages MapLibre imperative layers.
 */
export const BlockedEdgesLayer: React.FC = () => {
  const { map, graph, events } = useMapContext();

  const blockedEdgeItems = useMemo<EdgeFeatureEntry[]>(() => {
    if (!events || events.length === 0) return [];
    const items: EdgeFeatureEntry[] = [];
    for (const event of events) {
      if (event.active && event.effect.type === 'road_blockage') {
        for (const edgeId of event.edgeIds) {
          items.push({
            edgeId,
            extraProperties: { eventId: event.id },
          });
        }
      }
    }
    return items;
  }, [events]);

  const geojson = useEdgeGeoJSON(graph, blockedEdgeItems);

  const layer = useMemo<GeoJsonLayerSpec>(
    () => ({
      id: LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': BARRICADE_COLOR,
        'line-width': 4,
        'line-dasharray': [2, 2],
        'line-opacity': 0.95,
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
