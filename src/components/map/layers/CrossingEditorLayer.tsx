import type * as maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo, useRef } from 'react';

import { createCrossingBoundingCircleGeoJSON } from '../../../core/graph/crossing';
import { MAP_THEME_TOKENS } from '../../../core/rendering/theme';
import { useCrossingEditorData } from '../../../hooks/useCrossingEditorData';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../../hooks/useGeoJsonLayer';
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

  const { activeCluster, crossingSubgraph, computedTurnPath } = useCrossingEditorData({
    graph,
    customNodeDelays,
    showMinorControls,
    activeCrossingId,
    activeTurnSelection,
    enabled: isEditMode,
  });

  // Keep ref synchronized for event callbacks
  const activeTurnSelectionRef = useRef(activeTurnSelection);
  useEffect(() => {
    activeTurnSelectionRef.current = activeTurnSelection;
  }, [activeTurnSelection]);

  const circleLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: CIRCLE_FILL_LAYER_ID,
        type: 'fill',
        source: CIRCLE_SOURCE_ID,
        paint: {
          'fill-color': MAP_THEME_TOKENS.brand.indigo,
          'fill-opacity': 0.08,
        },
      },
      {
        id: CIRCLE_STROKE_LAYER_ID,
        type: 'line',
        source: CIRCLE_SOURCE_ID,
        paint: {
          'line-color': MAP_THEME_TOKENS.brand.indigo,
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      },
    ],
    [],
  );

  const edgesLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
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
      },
      {
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
      },
      {
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
      },
    ],
    [],
  );

  const turnPathLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: TURN_PATH_CASING_LAYER_ID,
        type: 'line',
        source: TURN_PATH_SOURCE_ID,
        paint: {
          'line-color': MAP_THEME_TOKENS.overlay.black,
          'line-width': 7,
          'line-opacity': 1.0,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      },
      {
        id: TURN_PATH_LINE_LAYER_ID,
        type: 'line',
        source: TURN_PATH_SOURCE_ID,
        paint: {
          'line-color': MAP_THEME_TOKENS.brand.amber,
          'line-width': 4,
          'line-opacity': 1.0,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      },
    ],
    [],
  );

  const nodeLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: NODES_CIRCLE_LAYER_ID,
        type: 'circle',
        source: NODES_SOURCE_ID,
        paint: {
          'circle-radius': ['match', ['get', 'status'], 'start', 8, 'end', 8, 'waypoint', 7, 5],
          'circle-color': [
            'match',
            ['get', 'status'],
            'start',
            MAP_THEME_TOKENS.status.success,
            'end',
            MAP_THEME_TOKENS.status.danger,
            'waypoint',
            MAP_THEME_TOKENS.brand.purple,
            MAP_THEME_TOKENS.overlay.white,
          ],
          'circle-stroke-color': MAP_THEME_TOKENS.overlay.darkNavy,
          'circle-stroke-width': 2,
        },
      },
    ],
    [],
  );

  // Memoized GeoJSON Data calculations
  const { circleGeoJson, edgesGeoJson, nodesGeoJson, turnPathGeoJson } = useMemo(() => {
    const emptyCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

    if (!isEditMode) {
      return {
        circleGeoJson: emptyCollection,
        edgesGeoJson: emptyCollection,
        nodesGeoJson: emptyCollection,
        turnPathGeoJson: emptyCollection,
      };
    }

    // A. Bounding Circle
    let circleData: GeoJSON.FeatureCollection = emptyCollection;
    if (activeCluster) {
      const circleFeat = createCrossingBoundingCircleGeoJSON(activeCluster);
      circleData = {
        type: 'FeatureCollection',
        features: [circleFeat as GeoJSON.Feature<GeoJSON.Polygon>],
      };
    }

    // B. Subgraph Edges & Nodes
    let edgesData: GeoJSON.FeatureCollection = emptyCollection;
    let nodesData: GeoJSON.FeatureCollection = emptyCollection;

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
      edgesData = { type: 'FeatureCollection', features: edgeFeatures };

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
      nodesData = { type: 'FeatureCollection', features: nodeFeatures };
    }

    // C. Computed Turn Path
    let turnPathData: GeoJSON.FeatureCollection = emptyCollection;
    if (crossingSubgraph && computedTurnPath && computedTurnPath.length >= 2) {
      const coords: [number, number][] = [];
      for (const id of computedTurnPath) {
        const node = crossingSubgraph.nodes.get(id);
        if (node) {
          coords.push([node.lng, node.lat]);
        }
      }
      turnPathData = {
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
      };
    }

    return {
      circleGeoJson: circleData,
      edgesGeoJson: edgesData,
      nodesGeoJson: nodesData,
      turnPathGeoJson: turnPathData,
    };
  }, [isEditMode, activeCluster, crossingSubgraph, computedTurnPath, activeTurnSelection]);

  useGeoJsonLayer({
    map,
    sourceId: CIRCLE_SOURCE_ID,
    layers: circleLayers,
    data: circleGeoJson,
  });

  useGeoJsonLayer({
    map,
    sourceId: EDGES_SOURCE_ID,
    layers: edgesLayers,
    data: edgesGeoJson,
  });

  useGeoJsonLayer({
    map,
    sourceId: TURN_PATH_SOURCE_ID,
    layers: turnPathLayers,
    data: turnPathGeoJson,
  });

  useGeoJsonLayer({
    map,
    sourceId: NODES_SOURCE_ID,
    layers: nodeLayers,
    data: nodesGeoJson,
  });

  // Interaction Listeners on Crossing Nodes and Edges
  useEffect(() => {
    if (!map) return;

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
        if (targetId !== current.fromNodeId) {
          setActiveTurnSelection((prev) => ({ ...prev, toNodeId: targetId }));
        } else if (sourceId !== current.fromNodeId) {
          setActiveTurnSelection((prev) => ({ ...prev, toNodeId: sourceId }));
        }
      } else {
        const waypoints = [...current.waypointNodeIds];
        const hasSource = waypoints.includes(sourceId);
        const hasTarget = waypoints.includes(targetId);

        if (!hasSource && sourceId !== current.fromNodeId && sourceId !== current.toNodeId) {
          waypoints.push(sourceId);
        } else if (hasSource) {
          const idx = waypoints.indexOf(sourceId);
          waypoints.splice(idx, 1);
        }

        if (!hasTarget && targetId !== current.fromNodeId && targetId !== current.toNodeId) {
          waypoints.push(targetId);
        } else if (hasTarget) {
          const idx = waypoints.indexOf(targetId);
          waypoints.splice(idx, 1);
        }

        setActiveTurnSelection((prev) => ({ ...prev, waypointNodeIds: waypoints }));
      }
    };

    const setCursorPointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const resetCursor = () => {
      map.getCanvas().style.cursor = '';
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
    };
  }, [map, setActiveTurnSelection]);

  return null;
};
