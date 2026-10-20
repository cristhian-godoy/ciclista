import type * as maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo } from 'react';

import { type EdgeFeatureEntry, useEdgeGeoJSON } from '../../hooks/useEdgeGeoJSON';
import { useMapContext } from './MapContext';

const SOURCE_ID = 'blocked-edges';
const LAYER_ID = 'blocked-edges-layer';
const BARRICADE_COLOR = '#f43f5e';

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

  // Register MapLibre source and dashed barricade layer
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
          'line-color': BARRICADE_COLOR,
          'line-width': 4,
          'line-dasharray': [2, 2],
          'line-opacity': 0.95,
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

  // Synchronize active road blockage edges into the GeoJSON layer source
  useEffect(() => {
    if (!map) return;

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source || typeof source.setData !== 'function') return;

    source.setData(geojson);
  }, [map, geojson]);

  return null;
};
