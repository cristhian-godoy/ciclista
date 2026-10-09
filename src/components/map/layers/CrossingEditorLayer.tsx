import type * as maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo, useRef } from 'react';

import {
  buildCrossingSubgraph,
  createCrossingBoundingCircleGeoJSON,
  extractCrossingClusters,
  findCrossingTurnPath,
} from '../../../core/graph/crossing';
import { useMapContext } from '../MapContext';

const CIRCLE_SOURCE_ID = 'crossing-editor-circle-source';
const CIRCLE_FILL_LAYER_ID = 'crossing-editor-circle-fill';
const CIRCLE_STROKE_LAYER_ID = 'crossing-editor-circle-stroke';

const EDGES_SOURCE_ID = 'crossing-editor-edges-source';
const EDGES_GLOW_LAYER_ID = 'crossing-editor-edges-glow';
const EDGES_LINE_LAYER_ID = 'crossing-editor-edges-line';
const CROSSING_EDGES_LAYER_ID = 'crossing-edges-layer';

const NODES_SOURCE_ID = 'crossing-editor-nodes-source';
const NODES_CIRCLE_LAYER_ID = 'crossing-editor-nodes-circle';

const TURN_PATH_SOURCE_ID = 'crossing-editor-turn-path-source';
const TURN_PATH_CASING_LAYER_ID = 'crossing-editor-turn-path-casing';
const TURN_PATH_LINE_LAYER_ID = 'crossing-editor-turn-path-line';

/**
 * Interactive map layer for Crossing Edit mode:
 * - Visualizes active crossing bounding circle and internal subgraph edges
 * - Enables direct interaction on crossing edges and nodes
 * - Renders computed turn path with black casing underlay and vibrant inner line
 *
 * @returns Null as this component imperatively manages MapLibre layers.
 */
export const CrossingEditorLayer: React.FC = () => {
  const {
    map,
    graph,
    appMode,
    activeCrossingId = null,
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
    if (!map.getLayer(CROSSING_EDGES_LAYER_ID)) {
      map.addLayer({
        id: CROSSING_EDGES_LAYER_ID,
        type: 'line',
        source: EDGES_SOURCE_ID,
        paint: {
          'line-width': 16,
          'line-opacity': 0.001,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    }

    // Turn path source & layers (Underlay casing + vibrant inner line)
    addSourceIfMissing(TURN_PATH_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    if (!map.getLayer(TURN_PATH_CASING_LAYER_ID)) {
      map.addLayer({
        id: TURN_PATH_CASING_LAYER_ID,
        type: 'line',
        source: TURN_PATH_SOURCE_ID,
        paint: {
          'line-color': '#000000',
          'line-width': 7,
          'line-opacity': 1.0,
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
          'line-width': 4,
          'line-opacity': 1.0,
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
    const handleNodeClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      const nodeId = feat?.properties?.nodeId ? String(feat.properties.nodeId) : null;
      if (!nodeId) return;

      const current = activeTurnSelectionRef.current;
      if (!current.fromNodeId) {
        setActiveTurnSelection((prev) => ({
          ...prev,
          fromNodeId: nodeId,
          toNodeId: null,
          waypointNodeIds: [],
        }));
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
        setActiveTurnSelection((prev) => ({
          ...prev,
          fromNodeId: sourceId,
          toNodeId: null,
          waypointNodeIds: [],
        }));
      } else if (!current.toNodeId) {
        const chosenEndId = targetId !== current.fromNodeId ? targetId : sourceId;
        if (chosenEndId !== current.fromNodeId) {
          setActiveTurnSelection((prev) => ({ ...prev, toNodeId: chosenEndId }));
        }
      } else if (sourceId === current.fromNodeId || targetId === current.fromNodeId) {
        setActiveTurnSelection((prev) => ({ ...prev, fromNodeId: null }));
      } else if (sourceId === current.toNodeId || targetId === current.toNodeId) {
        setActiveTurnSelection((prev) => ({ ...prev, toNodeId: null }));
      } else {
        setActiveTurnSelection((prev) => ({
          ...prev,
          fromNodeId: sourceId,
          toNodeId: null,
          waypointNodeIds: [],
        }));
      }
    };

    const setCursorPointer = () => {
      if (map.getCanvas?.()) map.getCanvas().style.cursor = 'pointer';
    };
    const resetCursor = () => {
      if (map.getCanvas?.()) map.getCanvas().style.cursor = '';
    };

    map.on('click', NODES_CIRCLE_LAYER_ID, handleNodeClick);
    map.on('mouseenter', NODES_CIRCLE_LAYER_ID, setCursorPointer);
    map.on('mouseleave', NODES_CIRCLE_LAYER_ID, resetCursor);

    map.on('click', CROSSING_EDGES_LAYER_ID, handleEdgeClick);
    map.on('mouseenter', CROSSING_EDGES_LAYER_ID, setCursorPointer);
    map.on('mouseleave', CROSSING_EDGES_LAYER_ID, resetCursor);

    map.on('click', EDGES_LINE_LAYER_ID, handleEdgeClick);
    map.on('mouseenter', EDGES_LINE_LAYER_ID, setCursorPointer);
    map.on('mouseleave', EDGES_LINE_LAYER_ID, resetCursor);

    return () => {
      map.off('click', NODES_CIRCLE_LAYER_ID, handleNodeClick);
      map.off('mouseenter', NODES_CIRCLE_LAYER_ID, setCursorPointer);
      map.off('mouseleave', NODES_CIRCLE_LAYER_ID, resetCursor);

      map.off('click', CROSSING_EDGES_LAYER_ID, handleEdgeClick);
      map.off('mouseenter', CROSSING_EDGES_LAYER_ID, setCursorPointer);
      map.off('mouseleave', CROSSING_EDGES_LAYER_ID, resetCursor);

      map.off('click', EDGES_LINE_LAYER_ID, handleEdgeClick);
      map.off('mouseenter', EDGES_LINE_LAYER_ID, setCursorPointer);
      map.off('mouseleave', EDGES_LINE_LAYER_ID, resetCursor);

      const layersToRemove = [
        CIRCLE_STROKE_LAYER_ID,
        CIRCLE_FILL_LAYER_ID,
        CROSSING_EDGES_LAYER_ID,
        EDGES_LINE_LAYER_ID,
        EDGES_GLOW_LAYER_ID,
        TURN_PATH_LINE_LAYER_ID,
        TURN_PATH_CASING_LAYER_ID,
        NODES_CIRCLE_LAYER_ID,
      ];
      for (const layerId of layersToRemove) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }

      const sourcesToRemove = [
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
  }, [map, setActiveTurnSelection]);

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
      setSourceData(CIRCLE_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      setSourceData(EDGES_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      setSourceData(NODES_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      setSourceData(TURN_PATH_SOURCE_ID, { type: 'FeatureCollection', features: [] });
      return;
    }

    // A. Active Bounding Circle GeoJSON
    if (activeCluster) {
      const circleFeat = createCrossingBoundingCircleGeoJSON(activeCluster);
      setSourceData(CIRCLE_SOURCE_ID, {
        type: 'FeatureCollection',
        features: [circleFeat as GeoJSON.Feature<GeoJSON.Polygon>],
      });
    } else {
      setSourceData(CIRCLE_SOURCE_ID, { type: 'FeatureCollection', features: [] });
    }

    // B. Subgraph Edges GeoJSON
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

      // C. Subgraph Nodes GeoJSON
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

    // D. Computed Turn Path GeoJSON
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
