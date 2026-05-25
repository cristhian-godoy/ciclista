import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

import { convertGraphToGeoJSON } from '../../core/graph/geojson';
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
    setManagedClusterId,
    setManagedNodeIds,
    onNodeSelect,
  } = useMapContext();

  // Keep callback handlers in refs to prevent stale closures in map listeners
  const onNodeSelectRef = useRef(onNodeSelect);
  const setManagedClusterIdRef = useRef(setManagedClusterId);
  const setManagedNodeIdsRef = useRef(setManagedNodeIds);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    setManagedClusterIdRef.current = setManagedClusterId;
  }, [setManagedClusterId]);

  useEffect(() => {
    setManagedNodeIdsRef.current = setManagedNodeIds;
  }, [setManagedNodeIds]);

  // Setup layers and sources
  useEffect(() => {
    if (!map) return;
    if (!map.getSource('network-streets')) {
      map.addSource('network-streets', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getSource('traffic-lights')) {
      map.addSource('traffic-lights', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: false,
      });
    }

    if (!map.getLayer('network-streets-layer')) {
      map.addLayer({
        id: 'network-streets-layer',
        type: 'line',
        source: 'network-streets',
        paint: {
          'line-color': 'rgba(99, 102, 241, 0.15)',
          'line-width': 1.5,
        },
      });
    }

    if (!map.getLayer('traffic-lights-cluster')) {
      map.addLayer({
        id: 'traffic-lights-cluster',
        type: 'circle',
        source: 'traffic-lights',
        filter: ['==', ['get', 'type'], 'crossing'],
        paint: {
          'circle-color': [
            'match',
            ['get', 'controlType'],
            'signal',
            '#ef4444', // Red for signals
            'stop',
            '#ea580c', // Orange-Red for stop signs
            'yield',
            '#f59e0b', // Amber/Yellow for yield signs
            'crossing',
            '#3b82f6', // Blue for pedestrian crossings
            '#9ca3af', // Grey fallback
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
            '#14b8a6', // Teal halo for custom delays
            '#ffffff', // White otherwise
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
      });
    }

    if (!map.getLayer('traffic-lights-unclustered')) {
      map.addLayer({
        id: 'traffic-lights-unclustered',
        type: 'circle',
        source: 'traffic-lights',
        filter: ['==', ['get', 'type'], 'signal-hidden'], // Start hidden
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
            '#14b8a6', // Custom delay timed nodes (Teal)
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
      });
    }

    // Set cursor handlers
    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetCursor = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('mouseenter', 'traffic-lights-unclustered', setPointerCursor);
    map.on('mouseleave', 'traffic-lights-unclustered', resetCursor);
    map.on('mouseenter', 'traffic-lights-cluster', setPointerCursor);
    map.on('mouseleave', 'traffic-lights-cluster', resetCursor);

    // Click handler for unclustered traffic signals
    const handleUnclusteredClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const properties = feature.properties;
      const geometry = feature.geometry;

      if (geometry && 'coordinates' in geometry && properties && properties.id) {
        const coords = (geometry as { coordinates: number[] }).coordinates;
        if (onNodeSelectRef.current) {
          onNodeSelectRef.current({
            id: properties.id,
            lat: coords[1],
            lng: coords[0],
            tags: JSON.parse((properties.tags as string) || '{}'),
          });
        }

        map.easeTo({
          center: [coords[0], coords[1]],
          duration: 400,
        });
      }
    };

    // Click handler for crossing clusters
    const handleClusterClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const geometry = feature.geometry;
      const properties = feature.properties;

      if (geometry && 'coordinates' in geometry && properties) {
        const coords = (geometry as { coordinates: number[] }).coordinates;
        const crossingId = properties.crossingId as string;
        const nodeIds = JSON.parse((properties.nodeIds as string) || '[]');

        if (setManagedClusterIdRef.current) {
          setManagedClusterIdRef.current(crossingId);
        }
        if (setManagedNodeIdsRef.current) {
          setManagedNodeIdsRef.current(nodeIds);
        }

        map.easeTo({
          center: [coords[0], coords[1]],
          zoom: 17.5,
        });
      }
    };

    map.on('click', 'traffic-lights-unclustered', handleUnclusteredClick);
    map.on('click', 'traffic-lights-cluster', handleClusterClick);

    return () => {
      map.off('mouseenter', 'traffic-lights-unclustered', setPointerCursor);
      map.off('mouseleave', 'traffic-lights-unclustered', resetCursor);
      map.off('mouseenter', 'traffic-lights-cluster', setPointerCursor);
      map.off('mouseleave', 'traffic-lights-cluster', resetCursor);
      map.off('click', 'traffic-lights-unclustered', handleUnclusteredClick);
      map.off('click', 'traffic-lights-cluster', handleClusterClick);

      // Clean up layers and sources
      if (map.getLayer('traffic-lights-unclustered')) {
        map.removeLayer('traffic-lights-unclustered');
      }
      if (map.getLayer('traffic-lights-cluster')) {
        map.removeLayer('traffic-lights-cluster');
      }
      if (map.getLayer('network-streets-layer')) {
        map.removeLayer('network-streets-layer');
      }
      if (map.getSource('traffic-lights')) {
        map.removeSource('traffic-lights');
      }
      if (map.getSource('network-streets')) {
        map.removeSource('network-streets');
      }
    };
  }, [map]);

  // Synchronize sources with data changes
  useEffect(() => {
    if (!map) return;
    let lineFeatures: GeoJSONFeature[] = [];
    let lightFeatures: GeoJSONFeature[] = [];

    if (graph) {
      const geojson = convertGraphToGeoJSON(graph, customNodeDelays, showMinorControls);
      lineFeatures = geojson.streets as GeoJSONFeature[];
      lightFeatures = geojson.controls as GeoJSONFeature[];
    }

    const streetSource = map.getSource('network-streets') as maplibregl.GeoJSONSource;
    if (streetSource) {
      streetSource.setData({
        type: 'FeatureCollection',
        features: lineFeatures,
      });
    }

    const lightSource = map.getSource('traffic-lights') as maplibregl.GeoJSONSource;
    if (lightSource) {
      lightSource.setData({
        type: 'FeatureCollection',
        features: lightFeatures,
      });
    }
  }, [map, graph, customNodeDelays, showMinorControls]);

  // Synchronize layer filters when managed states update
  useEffect(() => {
    if (!map) return;
    if (managedClusterId !== null && managedNodeIds.length > 0) {
      // Hide the managed crossing cluster, keep other crossing clusters visible
      map.setFilter('traffic-lights-cluster', [
        'all',
        ['==', ['get', 'type'], 'crossing'],
        ['!=', ['get', 'crossingId'], managedClusterId],
      ]);
      // Show ONLY the individual signals belonging to the managed crossing
      map.setFilter('traffic-lights-unclustered', [
        'all',
        ['==', ['get', 'type'], 'signal'],
        ['==', ['get', 'parentCrossingId'], managedClusterId],
      ]);
    } else {
      // Show all crossings
      map.setFilter('traffic-lights-cluster', ['==', ['get', 'type'], 'crossing']);
      // Hide all individual signals
      map.setFilter('traffic-lights-unclustered', ['==', ['get', 'type'], 'signal-hidden']);
    }
  }, [map, managedClusterId, managedNodeIds]);

  return null;
};
