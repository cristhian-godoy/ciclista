import React, { useEffect, useMemo, useRef } from 'react';

import { convertGraphToGeoJSON } from '../../core/graph/geojson';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { useMapContext } from './MapContext';

type GeoJSONFeature =
  | {
      type: 'Feature';
      geometry: {
        type: 'Point';
        coordinates: number[];
      };
      properties: Record<string, unknown>;
    }
  | {
      type: 'Feature';
      geometry: {
        type: 'LineString';
        coordinates: number[][];
      };
      properties: Record<string, unknown>;
    };

/**
 * Map layer rendering the raw street network edges (LineStrings) and
 * customizable intersection control nodes (Point clusters) directly on the map.
 */
export const StreetGraphLayer: React.FC = () => {
  const {
    map,
    graph,
    customNodeDelays,
    showMinorControls,
    managedClusterId,
    managedNodeIds,
    isPlacingPlace,
  } = useMapContext();

  const isPlacingPlaceRef = useRef(isPlacingPlace);
  useEffect(() => {
    isPlacingPlaceRef.current = isPlacingPlace;
  }, [isPlacingPlace]);

  const { streetFeatures, lightFeatures } = useMemo(() => {
    if (!graph) {
      return { streetFeatures: [] as GeoJSONFeature[], lightFeatures: [] as GeoJSONFeature[] };
    }
    const geojson = convertGraphToGeoJSON(graph, customNodeDelays, showMinorControls);
    return {
      streetFeatures: geojson.streets as GeoJSONFeature[],
      lightFeatures: geojson.controls as GeoJSONFeature[],
    };
  }, [graph, customNodeDelays, showMinorControls]);

  const streetLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: 'network-streets-layer',
        type: 'line',
        source: 'network-streets',
        paint: {
          'line-color': 'rgba(99, 102, 241, 0.15)',
          'line-width': 1.5,
        },
      },
    ],
    [],
  );

  const trafficLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: 'traffic-lights-cluster',
        type: 'circle',
        source: 'traffic-lights',
        filter: ['==', ['get', 'type'], 'crossing'],
        paint: {
          'circle-color': [
            'match',
            ['get', 'controlType'],
            'signal',
            '#ef4444',
            'stop',
            '#ea580c',
            'yield',
            '#f59e0b',
            'crossing',
            '#3b82f6',
            '#9ca3af',
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            [
              'match',
              ['get', 'controlType'],
              'signal',
              3,
              'stop',
              3,
              'yield',
              1.8,
              'crossing',
              1.8,
              3,
            ],
            14,
            ['match', ['get', 'controlType'], 'signal', 8, 'stop', 8, 'yield', 5, 'crossing', 5, 8],
            17,
            [
              'match',
              ['get', 'controlType'],
              'signal',
              16,
              'stop',
              16,
              'yield',
              10,
              'crossing',
              10,
              16,
            ],
          ],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'hasCustomDelay'], 'true'],
            '#14b8a6',
            '#ffffff',
          ],
          'circle-stroke-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            ['case', ['==', ['get', 'hasCustomDelay'], 'true'], 1.5, 0.5],
            14,
            ['case', ['==', ['get', 'hasCustomDelay'], 'true'], 3.0, 1.5],
            17,
            ['case', ['==', ['get', 'hasCustomDelay'], 'true'], 4.0, 2.0],
          ],
          'circle-opacity': 0.85,
        },
      },
      {
        id: 'traffic-lights-unclustered',
        type: 'circle',
        source: 'traffic-lights',
        filter: ['==', ['get', 'type'], 'signal-hidden'],
        paint: {
          'circle-radius': [
            'case',
            ['has', 'customDelay'],
            8,
            ['match', ['get', 'controlType'], 'signal', 6, 'stop', 6, 'yield', 4, 'crossing', 4, 6],
          ],
          'circle-color': [
            'case',
            ['has', 'customDelay'],
            '#14b8a6',
            [
              'match',
              ['get', 'controlType'],
              'signal',
              '#ef4444',
              'stop',
              '#ea580c',
              'yield',
              '#f59e0b',
              'crossing',
              '#3b82f6',
              '#9ca3af',
            ],
          ],
          'circle-stroke-width': ['case', ['has', 'customDelay'], 2.5, 1.5],
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.85,
        },
      },
    ],
    [],
  );

  const streetsGeoJson = useMemo(
    () => ({ type: 'FeatureCollection' as const, features: streetFeatures }),
    [streetFeatures],
  );

  const trafficGeoJson = useMemo(
    () => ({ type: 'FeatureCollection' as const, features: lightFeatures }),
    [lightFeatures],
  );

  useGeoJsonLayer({
    map,
    sourceId: 'network-streets',
    layers: streetLayers,
    data: streetsGeoJson,
  });

  useGeoJsonLayer({
    map,
    sourceId: 'traffic-lights',
    sourceOptions: { cluster: false },
    layers: trafficLayers,
    data: trafficGeoJson,
  });

  // Pointer cursor on hovering traffic signals
  useEffect(() => {
    if (!map) return;
    const setPointerCursor = () => {
      if (isPlacingPlaceRef.current) return;
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetCursor = () => {
      if (isPlacingPlaceRef.current) return;
      map.getCanvas().style.cursor = '';
    };

    map.on('mouseenter', 'traffic-lights-unclustered', setPointerCursor);
    map.on('mouseleave', 'traffic-lights-unclustered', resetCursor);
    map.on('mouseenter', 'traffic-lights-cluster', setPointerCursor);
    map.on('mouseleave', 'traffic-lights-cluster', resetCursor);

    return () => {
      map.off('mouseenter', 'traffic-lights-unclustered', setPointerCursor);
      map.off('mouseleave', 'traffic-lights-unclustered', resetCursor);
      map.off('mouseenter', 'traffic-lights-cluster', setPointerCursor);
      map.off('mouseleave', 'traffic-lights-cluster', resetCursor);
    };
  }, [map]);

  // Synchronize layer filters when managed states update
  useEffect(() => {
    if (!map) return;
    if (managedClusterId !== null && managedNodeIds.length > 0) {
      if (map.getLayer('traffic-lights-cluster')) {
        map.setFilter('traffic-lights-cluster', [
          'all',
          ['==', ['get', 'type'], 'crossing'],
          ['!=', ['get', 'crossingId'], managedClusterId],
        ]);
      }
      if (map.getLayer('traffic-lights-unclustered')) {
        map.setFilter('traffic-lights-unclustered', [
          'all',
          ['==', ['get', 'type'], 'signal'],
          ['==', ['get', 'parentCrossingId'], managedClusterId],
        ]);
      }
    } else {
      if (map.getLayer('traffic-lights-cluster')) {
        map.setFilter('traffic-lights-cluster', ['==', ['get', 'type'], 'crossing']);
      }
      if (map.getLayer('traffic-lights-unclustered')) {
        map.setFilter('traffic-lights-unclustered', ['==', ['get', 'type'], 'signal-hidden']);
      }
    }
  }, [map, managedClusterId, managedNodeIds]);

  return null;
};
