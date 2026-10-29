import type * as maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo, useRef } from 'react';

import { convertGraphToGeoJSONInWorker } from '../../core/graph/parser.client';
import type { NodeEntry } from '../../core/graph/types';
import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { useSettings } from '../../store/settingsStore';
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

const TRAFFIC_LIGHTS_SOURCE_OPTIONS = { cluster: false } as const;

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
    appMode,
    editSubMode = 'paths',
  } = useMapContext();
  const settings = useSettings();

  const isPlacingPlaceRef = useRef(isPlacingPlace);
  useEffect(() => {
    isPlacingPlaceRef.current = isPlacingPlace;
  }, [isPlacingPlace]);

  const streetLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: 'network-streets-layer',
        type: 'line',
        source: 'network-streets',
        layout: {
          visibility: settings.showStreetGraph ? 'visible' : 'none',
        },
        paint: {
          'line-color': 'rgba(99, 102, 241, 0.15)',
          'line-width': 1.5,
        },
      },
    ],
    [settings.showStreetGraph],
  );

  const trafficLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: 'traffic-lights-cluster',
        type: 'circle',
        source: 'traffic-lights',
        layout: {
          visibility: settings.showTrafficSignals ? 'visible' : 'none',
        },
        filter: ['==', ['get', 'type'], 'crossing'],
        paint: {
          'circle-color': [
            'match',
            ['get', 'controlType'],
            'signal',
            MAP_THEME_TOKENS.controls.signal, // Red for signals
            'stop',
            MAP_THEME_TOKENS.controls.stop, // Orange-Red for stop signs
            'yield',
            MAP_THEME_TOKENS.controls.yield, // Amber/Yellow for yield signs
            'crossing',
            MAP_THEME_TOKENS.controls.crossing, // Blue for pedestrian crossings
            MAP_THEME_TOKENS.controls.fallback, // Grey fallback
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
            MAP_THEME_TOKENS.controls.customTimed, // Teal halo for custom delays
            MAP_THEME_TOKENS.overlay.white, // White otherwise
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
        layout: {
          visibility: settings.showTrafficSignals ? 'visible' : 'none',
        },
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
            MAP_THEME_TOKENS.controls.customTimed, // Custom delay timed nodes (Teal)
            [
              'match',
              ['get', 'controlType'],
              'signal',
              MAP_THEME_TOKENS.controls.signal,
              'stop',
              MAP_THEME_TOKENS.controls.stop,
              'yield',
              MAP_THEME_TOKENS.controls.yield,
              'crossing',
              MAP_THEME_TOKENS.controls.crossing,
              MAP_THEME_TOKENS.controls.fallback,
            ],
          ],
          'circle-stroke-width': ['case', ['has', 'customDelay'], 2.5, 1.5],
          'circle-stroke-color': MAP_THEME_TOKENS.overlay.white,
          'circle-opacity': 0.85,
        },
      },
    ],
    [settings.showTrafficSignals],
  );

  useGeoJsonLayer({
    map,
    sourceId: 'network-streets',
    layers: streetLayers,
  });

  useGeoJsonLayer({
    map,
    sourceId: 'traffic-lights',
    sourceOptions: TRAFFIC_LIGHTS_SOURCE_OPTIONS,
    layers: trafficLayers,
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

  const accumulatedStreetsRef = useRef<Map<string, GeoJSONFeature>>(new Map());
  const processedNodeIdsRef = useRef<Set<string>>(new Set());
  const updateSeqRef = useRef<number>(0);

  // Synchronize sources with data changes incrementally via Web Worker
  useEffect(() => {
    if (!map) return;
    const seq = ++updateSeqRef.current;

    if (!graph || graph.nodes.size === 0) {
      accumulatedStreetsRef.current.clear();
      processedNodeIdsRef.current.clear();
      const streetSource = map.getSource('network-streets') as maplibregl.GeoJSONSource;
      if (streetSource) {
        streetSource.setData({ type: 'FeatureCollection', features: [] });
      }
      const lightSource = map.getSource('traffic-lights') as maplibregl.GeoJSONSource;
      if (lightSource) {
        lightSource.setData({ type: 'FeatureCollection', features: [] });
      }
      return;
    }

    // If graph was replaced with a different or smaller graph, reset cached features
    if (graph.nodes.size < processedNodeIdsRef.current.size) {
      accumulatedStreetsRef.current.clear();
      processedNodeIdsRef.current.clear();
    }

    // Extract newly added nodes that haven't had their line features computed yet
    const newNodes = new Map<string, NodeEntry>();
    for (const [id, entry] of graph.nodes.entries()) {
      if (!processedNodeIdsRef.current.has(id)) {
        newNodes.set(id, entry);
      }
    }

    const computeAndApply = async () => {
      // 1. If there are new nodes, compute their LineStrings in the worker and merge incrementally
      if (newNodes.size > 0) {
        const deltaGraph: { nodes: Map<string, NodeEntry> } = { nodes: new Map(newNodes) };
        for (const entry of newNodes.values()) {
          for (const edge of entry.edges) {
            if (!deltaGraph.nodes.has(edge.target)) {
              const targetEntry = graph.nodes.get(edge.target);
              if (targetEntry) {
                deltaGraph.nodes.set(edge.target, targetEntry);
              }
            }
          }
        }

        const deltaGeoJson = await convertGraphToGeoJSONInWorker(deltaGraph);
        if (updateSeqRef.current !== seq) return;

        for (const feature of deltaGeoJson.streets) {
          const edgeId = String(feature.properties.edgeId);
          accumulatedStreetsRef.current.set(edgeId, feature as GeoJSONFeature);
        }

        for (const id of newNodes.keys()) {
          processedNodeIdsRef.current.add(id);
        }

        const streetSource = map.getSource('network-streets') as maplibregl.GeoJSONSource;
        if (streetSource) {
          streetSource.setData({
            type: 'FeatureCollection',
            features: Array.from(accumulatedStreetsRef.current.values()),
          });
        }
      }

      // 2. Offload control points conversion to worker (handles custom delays & minor controls)
      const controlGeoJson = await convertGraphToGeoJSONInWorker(
        graph,
        customNodeDelays,
        showMinorControls,
      );
      if (updateSeqRef.current !== seq) return;

      const lightSource = map.getSource('traffic-lights') as maplibregl.GeoJSONSource;
      if (lightSource) {
        lightSource.setData({
          type: 'FeatureCollection',
          features: controlGeoJson.controls as GeoJSONFeature[],
        });
      }
    };

    void computeAndApply();
  }, [map, graph, customNodeDelays, showMinorControls]);

  // Synchronize layer filters when managed states update
  useEffect(() => {
    if (!map) return;
    const isEditMode = appMode === 'edit';
    const isSignalsSubMode = isEditMode && editSubMode === 'signals';
    const shouldAllowUnclustering =
      (isSignalsSubMode || !appMode) && managedClusterId !== null && managedNodeIds.length > 0;

    if (shouldAllowUnclustering) {
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
  }, [map, managedClusterId, managedNodeIds, appMode, editSubMode]);

  return null;
};
