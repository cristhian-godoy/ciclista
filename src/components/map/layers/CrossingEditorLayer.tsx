import type maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo, useRef } from 'react';

import {
  buildCrossingSubgraph,
  createCrossingBoundingCircleGeoJSON,
  extractCrossingClusters,
  findCrossingTurnPath,
} from '../../../core/graph/crossing';
import { useMapContext } from '../MapContext';

const CLUSTERS_SOURCE_ID = 'crossing-editor-clusters-source';
const CLUSTERS_GLOW_LAYER_ID = 'crossing-editor-clusters-glow';
const CLUSTERS_CIRCLE_LAYER_ID = 'crossing-editor-clusters-circle';

const CIRCLE_SOURCE_ID = 'crossing-editor-circle-source';
const CIRCLE_FILL_LAYER_ID = 'crossing-editor-circle-fill';
const CIRCLE_STROKE_LAYER_ID = 'crossing-editor-circle-stroke';

const EDGES_SOURCE_ID = 'crossing-editor-edges-source';
const EDGES_GLOW_LAYER_ID = 'crossing-editor-edges-glow';
const EDGES_LINE_LAYER_ID = 'crossing-editor-edges-line';

const NODES_SOURCE_ID = 'crossing-editor-nodes-source';
const NODES_CIRCLE_LAYER_ID = 'crossing-editor-nodes-circle';

const TURN_PATH_SOURCE_ID = 'crossing-editor-turn-path-source';
const TURN_PATH_GLOW_LAYER_ID = 'crossing-editor-turn-path-glow';
const TURN_PATH_LINE_LAYER_ID = 'crossing-editor-turn-path-line';
const TURN_PATH_CUE_LAYER_ID = 'crossing-editor-turn-path-cue';

/**
 * Interactive map layer for Crossing Edit mode:
 * - Highlights crossing clusters
 * - Draws dynamic bounding circle around active crossing
 * - Highlights crossing subgraph edges with semantic colors
 * - Displays interactive nodes for selecting turn start, end, and waypoints
 * - Renders computed turn path in amber with directional cues
 */
export const CrossingEditorLayer: React.FC = () => {
  const {
    map,
    graph,
    appMode,
    activeCrossingId = null,
    setActiveCrossingId = () => {},
    activeTurnSelection = { fromNodeId: null, toNodeId: null, waypointNodeIds: [] },
    setActiveTurnSelection = () => {},
    customNodeDelays,
    showMinorControls,
  } = useMapContext();

  const isEditMode = appMode === 'edit';

  const clusters = useMemo(() => {
    if (!graph || !isEditMode) return [];
    return extractCrossingClusters(graph, customNodeDelays, showMinorControls);
  }, [graph, isEditMode, customNodeDelays, showMinorControls]);

  const activeCluster = useMemo(() => {
    if (!activeCrossingId || !isEditMode) return null;
    return clusters.find((c) => c.id === activeCrossingId) ?? null;
  }, [clusters, activeCrossingId, isEditMode]);

  const crossingSubgraph = useMemo(() => {
    if (!graph || !activeCluster) return null;
    return buildCrossingSubgraph(graph, activeCluster);
  }, [graph, activeCluster]);

  const computedTurnPath = useMemo(() => {
    if (!crossingSubgraph || !activeTurnSelection.fromNodeId || !activeTurnSelection.toNodeId) {
      return null;
    }
    return findCrossingTurnPath(
      crossingSubgraph,
      activeTurnSelection.fromNodeId,
      activeTurnSelection.toNodeId,
      activeTurnSelection.waypointNodeIds,
    );
  }, [crossingSubgraph, activeTurnSelection]);

  // Keep ref synchronized for event callbacks
  const activeTurnSelectionRef = useRef(activeTurnSelection);
  useEffect(() => {
    activeTurnSelectionRef.current = activeTurnSelection;
  }, [activeTurnSelection]);

  // 1. Lifecycle: Setup and Teardown Sources and Layers
  useEffect(() => {
    if (!map) return;

    const addSourceIfMissing = (id: string, data: GeoJSON.GeoJSON) => {
      if (!map.getSource(id)) {
        map.addSource(id, {
          type: 'geojson',
          data,
        });
      }
    };

    // Clusters source
    addSourceIfMissing(CLUSTERS_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    if (!map.getLayer(CLUSTERS_GLOW_LAYER_ID)) {
      map.addLayer({
        id: CLUSTERS_GLOW_LAYER_ID,
        type: 'circle',
        source: CLUSTERS_SOURCE_ID,
        paint: {
          'circle-radius': 14,
          'circle-color': '#6366f1',
          'circle-opacity': 0.25,
        },
      });
    }
    if (!map.getLayer(CLUSTERS_CIRCLE_LAYER_ID)) {
      map.addLayer({
        id: CLUSTERS_CIRCLE_LAYER_ID,
        type: 'circle',
        source: CLUSTERS_SOURCE_ID,
        paint: {
          'circle-radius': 9,
          'circle-color': '#6366f1',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    // Bounding circle source & layers
    addSourceIfMissing(CIRCLE_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    if (!map.getLayer(CIRCLE_FILL_LAYER_ID)) {
      map.addLayer({
        id: CIRCLE_FILL_LAYER_ID,
        type: 'fill',
        source: CIRCLE_SOURCE_ID,
        paint: {
          'fill-color': '#6366f1',
          'fill-opacity': 0.08,
        },
      });
    }
    if (!map.getLayer(CIRCLE_STROKE_LAYER_ID)) {
      map.addLayer({
        id: CIRCLE_STROKE_LAYER_ID,
        type: 'line',
        source: CIRCLE_SOURCE_ID,
        paint: {
          'line-color': '#6366f1',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
    }

    // Subgraph edges source & layers
    addSourceIfMissing(EDGES_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    if (!map.getLayer(EDGES_GLOW_LAYER_ID)) {
      map.addLayer({
        id: EDGES_GLOW_LAYER_ID,
        type: 'line',
        source: EDGES_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 6,
          'line-opacity': 0.35,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    }
    if (!map.getLayer(EDGES_LINE_LAYER_ID)) {
      map.addLayer({
        id: EDGES_LINE_LAYER_ID,
        type: 'line',
        source: EDGES_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3.5,
          'line-opacity': 0.95,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    }

    // Turn path source & layers
    addSourceIfMissing(TURN_PATH_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    if (!map.getLayer(TURN_PATH_GLOW_LAYER_ID)) {
      map.addLayer({
        id: TURN_PATH_GLOW_LAYER_ID,
        type: 'line',
        source: TURN_PATH_SOURCE_ID,
        paint: {
          'line-color': '#f59e0b',
          'line-width': 10,
          'line-opacity': 0.45,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    }
    if (!map.getLayer(TURN_PATH_LINE_LAYER_ID)) {
      map.addLayer({
        id: TURN_PATH_LINE_LAYER_ID,
        type: 'line',
        source: TURN_PATH_SOURCE_ID,
        paint: {
          'line-color': '#f59e0b',
          'line-width': 5.5,
          'line-opacity': 1.0,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    }
    if (!map.getLayer(TURN_PATH_CUE_LAYER_ID)) {
      map.addLayer({
        id: TURN_PATH_CUE_LAYER_ID,
        type: 'line',
        source: TURN_PATH_SOURCE_ID,
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.5,
          'line-dasharray': [1.5, 2],
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    }

    // Subgraph nodes source & layer
    addSourceIfMissing(NODES_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    if (!map.getLayer(NODES_CIRCLE_LAYER_ID)) {
      map.addLayer({
        id: NODES_CIRCLE_LAYER_ID,
        type: 'circle',
        source: NODES_SOURCE_ID,
        paint: {
          'circle-radius': ['match', ['get', 'status'], 'start', 8, 'end', 8, 'waypoint', 7, 5],
          'circle-color': [
            'match',
            ['get', 'status'],
            'start',
            '#10b981',
            'end',
            '#ef4444',
            'waypoint',
            '#8b5cf6',
            '#ffffff',
          ],
          'circle-stroke-color': '#0f172a',
          'circle-stroke-width': 2,
        },
      });
    }

    // Interaction Listeners
    const handleClusterClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      const crossingId = feat?.properties?.crossingId;
      if (crossingId) {
        setActiveCrossingId(String(crossingId));
      }
    };

    const handleNodeClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      const nodeId = feat?.properties?.nodeId ? String(feat.properties.nodeId) : null;
      if (!nodeId) return;

      const current = activeTurnSelectionRef.current;
      if (!current.fromNodeId) {
        setActiveTurnSelection((prev) => ({ ...prev, fromNodeId: nodeId }));
      } else if (!current.toNodeId) {
        if (nodeId !== current.fromNodeId) {
          setActiveTurnSelection((prev) => ({ ...prev, toNodeId: nodeId }));
        }
      } else if (nodeId === current.fromNodeId) {
        setActiveTurnSelection((prev) => ({ ...prev, fromNodeId: null }));
      } else if (nodeId === current.toNodeId) {
        setActiveTurnSelection((prev) => ({ ...prev, toNodeId: null }));
      } else {
        // Intermediate waypoint toggle
        setActiveTurnSelection((prev) => {
          const exists = prev.waypointNodeIds.includes(nodeId);
          return {
            ...prev,
            waypointNodeIds: exists
              ? prev.waypointNodeIds.filter((id) => id !== nodeId)
              : [...prev.waypointNodeIds, nodeId],
          };
        });
      }
    };

    const handleEdgeClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      const sourceId = feat?.properties?.sourceId ? String(feat.properties.sourceId) : null;
      const targetId = feat?.properties?.targetId ? String(feat.properties.targetId) : null;
      if (!sourceId || !targetId) return;

      const current = activeTurnSelectionRef.current;
      if (!current.fromNodeId) {
        setActiveTurnSelection((prev) => ({ ...prev, fromNodeId: sourceId, toNodeId: targetId }));
      }
    };

    const setCursorPointer = () => {
      if (map.getCanvas?.()) map.getCanvas().style.cursor = 'pointer';
    };
    const resetCursor = () => {
      if (map.getCanvas?.()) map.getCanvas().style.cursor = '';
    };

    map.on('click', CLUSTERS_CIRCLE_LAYER_ID, handleClusterClick);
    map.on('mouseenter', CLUSTERS_CIRCLE_LAYER_ID, setCursorPointer);
    map.on('mouseleave', CLUSTERS_CIRCLE_LAYER_ID, resetCursor);

    map.on('click', NODES_CIRCLE_LAYER_ID, handleNodeClick);
    map.on('mouseenter', NODES_CIRCLE_LAYER_ID, setCursorPointer);
    map.on('mouseleave', NODES_CIRCLE_LAYER_ID, resetCursor);

    map.on('click', EDGES_LINE_LAYER_ID, handleEdgeClick);
    map.on('mouseenter', EDGES_LINE_LAYER_ID, setCursorPointer);
    map.on('mouseleave', EDGES_LINE_LAYER_ID, resetCursor);

    return () => {
      map.off('click', CLUSTERS_CIRCLE_LAYER_ID, handleClusterClick);
      map.off('mouseenter', CLUSTERS_CIRCLE_LAYER_ID, setCursorPointer);
      map.off('mouseleave', CLUSTERS_CIRCLE_LAYER_ID, resetCursor);

      map.off('click', NODES_CIRCLE_LAYER_ID, handleNodeClick);
      map.off('mouseenter', NODES_CIRCLE_LAYER_ID, setCursorPointer);
      map.off('mouseleave', NODES_CIRCLE_LAYER_ID, resetCursor);

      map.off('click', EDGES_LINE_LAYER_ID, handleEdgeClick);
      map.off('mouseenter', EDGES_LINE_LAYER_ID, setCursorPointer);
      map.off('mouseleave', EDGES_LINE_LAYER_ID, resetCursor);

      const layersToRemove = [
        CLUSTERS_CIRCLE_LAYER_ID,
        CLUSTERS_GLOW_LAYER_ID,
        CIRCLE_STROKE_LAYER_ID,
        CIRCLE_FILL_LAYER_ID,
        EDGES_LINE_LAYER_ID,
        EDGES_GLOW_LAYER_ID,
        TURN_PATH_CUE_LAYER_ID,
        TURN_PATH_LINE_LAYER_ID,
        TURN_PATH_GLOW_LAYER_ID,
        NODES_CIRCLE_LAYER_ID,
      ];
      for (const layerId of layersToRemove) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }

      const sourcesToRemove = [
        CLUSTERS_SOURCE_ID,
        CIRCLE_SOURCE_ID,
        EDGES_SOURCE_ID,
        TURN_PATH_SOURCE_ID,
        NODES_SOURCE_ID,
      ];
      for (const sourceId of sourcesToRemove) {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      }
    };
  }, [map, setActiveCrossingId, setActiveTurnSelection]);

  // 2. Synchronize Data into Sources
  useEffect(() => {
    if (!map) return;

    const setSourceData = (sourceId: string, data: GeoJSON.GeoJSON) => {
      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
      if (source && typeof source.setData === 'function') {
        source.setData(data);
      }
    };

    if (!isEditMode) {
      // Clear all sources when not in edit mode
      setSourceData(CLUSTERS_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      setSourceData(CIRCLE_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      setSourceData(EDGES_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      setSourceData(NODES_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      setSourceData(TURN_PATH_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      return;
    }

    // A. Clusters GeoJSON
    const clusterFeatures: GeoJSON.Feature<GeoJSON.Point>[] = clusters.map((c) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [c.lng, c.lat],
      },
      properties: {
        crossingId: c.id,
        nodeCount: c.nodeIds.length,
        radiusMeters: c.radiusMeters,
        controlType: c.controlType,
      },
    }));
    setSourceData(CLUSTERS_SOURCE_ID, {
      type: 'FeatureCollection',
      features: clusterFeatures,
    });

    // B. Active Bounding Circle GeoJSON
    if (activeCluster) {
      const circleFeat = createCrossingBoundingCircleGeoJSON(activeCluster);
      setSourceData(CIRCLE_SOURCE_ID, {
        type: 'FeatureCollection',
        features: [circleFeat as GeoJSON.Feature<GeoJSON.Polygon>],
      });
    } else {
      setSourceData(CIRCLE_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    }

    // C. Subgraph Edges GeoJSON
    if (crossingSubgraph) {
      const edgeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = crossingSubgraph.edges.map(
        (edge) => {
          const u = crossingSubgraph.nodes.get(edge.sourceId);
          const v = crossingSubgraph.nodes.get(edge.targetId);
          const uCoords = u ? [u.lng, u.lat] : [0, 0];
          const vCoords = v ? [v.lng, v.lat] : [0, 0];
          return {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [uCoords, vCoords],
            },
            properties: {
              edgeId: edge.edgeId,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              color: edge.color,
              category: edge.category,
              label: edge.label,
            },
          };
        },
      );
      setSourceData(EDGES_SOURCE_ID, {
        type: 'FeatureCollection',
        features: edgeFeatures,
      });

      // D. Subgraph Nodes GeoJSON
      const nodeFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
      crossingSubgraph.nodes.forEach((node) => {
        let status: 'start' | 'end' | 'waypoint' | 'normal' = 'normal';
        if (node.id === activeTurnSelection.fromNodeId) {
          status = 'start';
        } else if (node.id === activeTurnSelection.toNodeId) {
          status = 'end';
        } else if (activeTurnSelection.waypointNodeIds.includes(node.id)) {
          status = 'waypoint';
        }

        nodeFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [node.lng, node.lat],
          },
          properties: {
            nodeId: node.id,
            status,
            isClusterNode: node.isClusterNode,
          },
        });
      });
      setSourceData(NODES_SOURCE_ID, {
        type: 'FeatureCollection',
        features: nodeFeatures,
      });
    } else {
      setSourceData(EDGES_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      setSourceData(NODES_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    }

    // E. Computed Turn Path GeoJSON
    if (crossingSubgraph && computedTurnPath && computedTurnPath.length >= 2) {
      const coords: [number, number][] = [];
      for (const id of computedTurnPath) {
        const node = crossingSubgraph.nodes.get(id);
        if (node) {
          coords.push([node.lng, node.lat]);
        }
      }
      setSourceData(TURN_PATH_SOURCE_ID, {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: {
              active: true,
            },
          },
        ],
      });
    } else {
      setSourceData(TURN_PATH_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    }
  }, [
    map,
    isEditMode,
    clusters,
    activeCluster,
    crossingSubgraph,
    computedTurnPath,
    activeTurnSelection,
  ]);

  return null;
};
