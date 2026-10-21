import type * as maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

import { convertGraphToGeoJSONInWorker } from '../../core/graph/parser.client';
import type { NodeEntry } from '../../core/graph/types';
import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
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
    isPlacingPlace,
    setActiveCrossingId,
  } = useMapContext();

  // Keep callback handlers in refs to prevent stale closures in map listeners
  const onNodeSelectRef = useRef(onNodeSelect);
  const setManagedClusterIdRef = useRef(setManagedClusterId);
  const setManagedNodeIdsRef = useRef(setManagedNodeIds);
  const setActiveCrossingIdRef = useRef(setActiveCrossingId);
  const graphRef = useRef(graph);
  const isPlacingPlaceRef = useRef(isPlacingPlace);

  useEffect(() => {
    isPlacingPlaceRef.current = isPlacingPlace;
  }, [isPlacingPlace]);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    setManagedClusterIdRef.current = setManagedClusterId;
  }, [setManagedClusterId]);

  useEffect(() => {
    setManagedNodeIdsRef.current = setManagedNodeIds;
  }, [setManagedNodeIds]);

  useEffect(() => {
    setActiveCrossingIdRef.current = setActiveCrossingId;
  }, [setActiveCrossingId]);

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
      });
    }

    // Set cursor handlers
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

    // Click handler for unclustered traffic signals
    const handleUnclusteredClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (isPlacingPlaceRef.current) {
        // In pin placement mode: bypass signal selection so map click handles coordinate picking
        return;
      }
      e.preventDefault();
      if (e.originalEvent) {
        e.originalEvent.preventDefault?.();
        e.originalEvent.stopPropagation?.();
      }
      const mapWithDrag = map as unknown as { isDragging?: () => boolean };
      if (typeof mapWithDrag.isDragging === 'function' && mapWithDrag.isDragging()) return;
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const properties = feature.properties;
      const geometry = feature.geometry;

      if (geometry && 'coordinates' in geometry && properties && properties.id) {
        const coords = (geometry as { coordinates: number[] }).coordinates;
        const nodeId = String(properties.id);
        const nodeEntry = graphRef.current?.nodes.get(nodeId);

        let tags: Record<string, string> = {};
        if (properties.tags) {
          if (typeof properties.tags === 'string') {
            try {
              tags = JSON.parse(properties.tags);
            } catch {
              tags = {};
            }
          } else if (typeof properties.tags === 'object') {
            tags = properties.tags as Record<string, string>;
          }
        }

        if (onNodeSelectRef.current) {
          const target = nodeEntry?.node ?? {
            id: nodeId,
            lat: coords[1],
            lng: coords[0],
            tags:
              nodeEntry?.node.tags ??
              (Object.keys(tags).length > 0 ? tags : { highway: 'traffic_signals' }),
          };
          onNodeSelectRef.current({ ...target });
        }

        map.easeTo({
          center: [coords[0], coords[1]],
          duration: 400,
        });
      }
    };

    // Click handler for crossing clusters
    const handleClusterClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (isPlacingPlaceRef.current) {
        // In pin placement mode: bypass cluster expansion so map click handles coordinate picking
        return;
      }
      e.preventDefault();
      if (e.originalEvent) {
        e.originalEvent.preventDefault?.();
        e.originalEvent.stopPropagation?.();
      }
      const mapWithDrag = map as unknown as { isDragging?: () => boolean };
      if (typeof mapWithDrag.isDragging === 'function' && mapWithDrag.isDragging()) return;
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const geometry = feature.geometry;
      const properties = feature.properties;

      if (geometry && 'coordinates' in geometry && properties) {
        const coords = (geometry as { coordinates: number[] }).coordinates;
        const crossingId = properties.crossingId as string;
        let nodeIds: string[] = [];
        if (properties.nodeIds) {
          if (typeof properties.nodeIds === 'string') {
            try {
              nodeIds = JSON.parse(properties.nodeIds);
            } catch {
              nodeIds = [];
            }
          } else if (Array.isArray(properties.nodeIds)) {
            nodeIds = properties.nodeIds.map(String);
          }
        }

        if (setManagedClusterIdRef.current) {
          setManagedClusterIdRef.current(crossingId);
        }
        if (setManagedNodeIdsRef.current) {
          setManagedNodeIdsRef.current(nodeIds);
        }
        if (setActiveCrossingIdRef.current) {
          setActiveCrossingIdRef.current(crossingId);
        }

        map.easeTo({
          center: [coords[0], coords[1]],
          zoom: 17.5,
          duration: 400,
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
