import * as maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { buildSegmentedPathGeoJSON } from '../../core/rendering/geometry-mapper';
import { buildPathSymbolsGeoJSON } from '../../core/rendering/symbols-mapper';
import { MAP_THEME_TOKENS, PALETTES } from '../../core/rendering/theme';
import type { PathSegmentFeature } from '../../core/rendering/types';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { UnifiedPathLayer } from './layers/UnifiedPathLayer';
import { useMapContext } from './MapContext';

/**
 * Renders interactive node circles along the active path and divergent alternative path line segments
 * when inspector mode is active and a node is selected.
 */
export const InspectorLayer: React.FC = () => {
  const {
    map,
    graph,
    isInspectorModeActive,
    selectedNodeId,
    setSelectedNodeId,
    routeVariants,
    activeAlternativeLabel,
    selectedAlternativeTargetId,
    setSelectedAlternativeTargetId,
    inspectorBranches,
  } = useMapContext();

  const [hoveredAlternativeTargetId, setHoveredAlternativeTargetId] = useState<string | null>(null);

  const setSelectedNodeIdRef = useRef(setSelectedNodeId);
  const selectedAlternativeTargetIdRef = useRef(selectedAlternativeTargetId);
  const setSelectedAlternativeTargetIdRef = useRef(setSelectedAlternativeTargetId);
  const inspectorBranchesRef = useRef(inspectorBranches);
  const routeVariantsRef = useRef(routeVariants);
  const activeAlternativeLabelRef = useRef(activeAlternativeLabel);

  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    setSelectedNodeIdRef.current = setSelectedNodeId;
    selectedAlternativeTargetIdRef.current = selectedAlternativeTargetId;
    setSelectedAlternativeTargetIdRef.current = setSelectedAlternativeTargetId;
    inspectorBranchesRef.current = inspectorBranches;
    routeVariantsRef.current = routeVariants;
    activeAlternativeLabelRef.current = activeAlternativeLabel;
  }, [
    setSelectedNodeId,
    selectedAlternativeTargetId,
    setSelectedAlternativeTargetId,
    inspectorBranches,
    routeVariants,
    activeAlternativeLabel,
  ]);

  // Initialize and clean up hover popup
  useEffect(() => {
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'inspector-hover-popup',
    });
    popupRef.current = popup;

    return () => {
      popup.remove();
      popupRef.current = null;
    };
  }, []);

  // Layers definitions for inspector sources
  const nodesLayer = useMemo<GeoJsonLayerSpec>(
    () => ({
      id: 'inspector-nodes-layer',
      type: 'circle',
      source: 'inspector-nodes',
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 9, 6],
        'circle-color': MAP_THEME_TOKENS.status.info,
        'circle-stroke-width': 2,
        'circle-stroke-color': MAP_THEME_TOKENS.overlay.white,
        'circle-opacity': 0.9,
        'circle-stroke-opacity': 0.9,
      },
    }),
    [],
  );

  const nodeSymbolsLayer = useMemo<GeoJsonLayerSpec>(
    () => ({
      id: 'inspector-node-symbols-layer',
      type: 'symbol',
      source: 'inspector-node-symbols',
      layout: {
        'text-field': [
          'match',
          ['get', 'type'],
          'signal',
          '🚦',
          'stop',
          '🛑',
          'yield',
          '⚠️',
          'crossing',
          '🚸',
          '',
        ],
        'text-size': 14,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'type'],
          'signal',
          MAP_THEME_TOKENS.brand.amber,
          'stop',
          MAP_THEME_TOKENS.status.danger,
          'yield',
          PALETTES.alternative,
          'crossing',
          MAP_THEME_TOKENS.status.info,
          MAP_THEME_TOKENS.overlay.white,
        ],
        'text-halo-color': MAP_THEME_TOKENS.overlay.black,
        'text-halo-width': 1.5,
      },
    }),
    [],
  );

  const turnArrowsLayer = useMemo<GeoJsonLayerSpec>(
    () => ({
      id: 'inspector-turn-arrows-layer',
      type: 'symbol',
      source: 'inspector-turn-arrows',
      layout: {
        'text-field': '⬆',
        'text-size': 12,
        'text-rotate': ['get', 'bearing'],
        'text-rotation-alignment': 'map',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': MAP_THEME_TOKENS.overlay.white,
        'text-halo-color': MAP_THEME_TOKENS.overlay.black,
        'text-halo-width': 1.5,
      },
    }),
    [],
  );

  const alternativeLabelsLayer = useMemo<GeoJsonLayerSpec>(
    () => ({
      id: 'inspector-alternative-labels-layer',
      type: 'symbol',
      source: 'inspector-alternative-labels',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 10,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': MAP_THEME_TOKENS.overlay.white,
        'text-halo-color': MAP_THEME_TOKENS.overlay.black,
        'text-halo-width': 1.5,
      },
    }),
    [],
  );

  const activeRoute = useMemo(() => {
    return routeVariants.find((a) => a.label === activeAlternativeLabel);
  }, [routeVariants, activeAlternativeLabel]);

  const { nodesGeoJson, nodeSymbolsGeoJson, turnArrowsGeoJson, labelsGeoJson } = useMemo(() => {
    const empty = { type: 'FeatureCollection' as const, features: [] };
    const pathNodeIds = activeRoute?.result?.pathNodeIds ?? [];

    if (!isInspectorModeActive || pathNodeIds.length === 0 || !activeRoute) {
      return {
        nodesGeoJson: empty,
        nodeSymbolsGeoJson: empty,
        turnArrowsGeoJson: empty,
        labelsGeoJson: empty,
      };
    }

    const nodeFeatures = pathNodeIds
      .map((nodeId, idx) => {
        const entry = graph?.nodes.get(nodeId);
        if (!entry) return null;

        const nextNodeId = pathNodeIds[idx + 1];
        const prevNodeId = idx > 0 ? pathNodeIds[idx - 1] : null;

        const hasDiverging = entry.edges.some(
          (edge) => edge.target !== nextNodeId && edge.target !== prevNodeId,
        );

        if (!hasDiverging) {
          return null;
        }

        return {
          type: 'Feature' as const,
          id: idx,
          geometry: {
            type: 'Point' as const,
            coordinates: [entry.node.lng, entry.node.lat],
          },
          properties: {
            nodeId,
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const symbolsData = buildPathSymbolsGeoJSON(activeRoute.result, graph ?? { nodes: new Map() });
    const symbolsFeatures = symbolsData.features.filter((f) => f.properties.type !== 'turn');
    const turnFeatures = symbolsData.features.filter((f) => f.properties.type === 'turn');

    let labelFeatures: Array<{
      type: 'Feature';
      geometry: { type: 'Point'; coordinates: number[] };
      properties: { name: string };
    }> = [];

    if (selectedNodeId && graph && inspectorBranches.length > 0) {
      const startNode = graph.nodes.get(selectedNodeId)?.node;
      if (startNode) {
        labelFeatures = inspectorBranches
          .map((ev) => {
            const endNode = graph.nodes.get(ev.targetId)?.node;
            if (!endNode) return null;
            const midLng = (startNode.lng + endNode.lng) / 2;
            const midLat = (startNode.lat + endNode.lat) / 2;
            return {
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [midLng, midLat],
              },
              properties: {
                name: ev.name,
              },
            };
          })
          .filter((f): f is NonNullable<typeof f> => f !== null);
      }
    }

    return {
      nodesGeoJson: { type: 'FeatureCollection' as const, features: nodeFeatures },
      nodeSymbolsGeoJson: { type: 'FeatureCollection' as const, features: symbolsFeatures },
      turnArrowsGeoJson: { type: 'FeatureCollection' as const, features: turnFeatures },
      labelsGeoJson: { type: 'FeatureCollection' as const, features: labelFeatures },
    };
  }, [activeRoute, isInspectorModeActive, graph, selectedNodeId, inspectorBranches]);

  useGeoJsonLayer({
    map,
    sourceId: 'inspector-nodes',
    layer: nodesLayer,
    data: nodesGeoJson,
  });

  useGeoJsonLayer({
    map,
    sourceId: 'inspector-node-symbols',
    layer: nodeSymbolsLayer,
    data: nodeSymbolsGeoJson,
  });

  useGeoJsonLayer({
    map,
    sourceId: 'inspector-turn-arrows',
    layer: turnArrowsLayer,
    data: turnArrowsGeoJson,
  });

  useGeoJsonLayer({
    map,
    sourceId: 'inspector-alternative-labels',
    layer: alternativeLabelsLayer,
    data: labelsGeoJson,
  });

  // Attach hover and click listeners for interactive inspector nodes
  useEffect(() => {
    if (!map) return;
    let hoveredNodeId: string | number | null = null;

    const onMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features[0];
        if (hoveredNodeId !== null) {
          map.setFeatureState({ source: 'inspector-nodes', id: hoveredNodeId }, { hover: false });
        }
        if (typeof feature.id === 'string' || typeof feature.id === 'number') {
          hoveredNodeId = feature.id;
          map.setFeatureState({ source: 'inspector-nodes', id: hoveredNodeId }, { hover: true });
        } else {
          hoveredNodeId = null;
        }
      }
    };

    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      if (hoveredNodeId !== null) {
        map.setFeatureState({ source: 'inspector-nodes', id: hoveredNodeId }, { hover: false });
        hoveredNodeId = null;
      }
    };

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      if (e.features && e.features.length > 0) {
        const nodeId = e.features[0].properties.nodeId;
        setSelectedNodeIdRef.current(nodeId);
      }
    };

    map.on('mousemove', 'inspector-nodes-layer', onMouseMove);
    map.on('mouseleave', 'inspector-nodes-layer', onMouseLeave);
    map.on('click', 'inspector-nodes-layer', onClick);

    return () => {
      map.off('mousemove', 'inspector-nodes-layer', onMouseMove);
      map.off('mouseleave', 'inspector-nodes-layer', onMouseLeave);
      map.off('click', 'inspector-nodes-layer', onClick);
      if (popupRef.current) popupRef.current.remove();
    };
  }, [map]);

  // Compute precision geometries for chosen path
  const chosenPathFeatures = useMemo(() => {
    if (!isInspectorModeActive || !activeRoute || !activeRoute.result) return [];
    return buildSegmentedPathGeoJSON(activeRoute.result).features;
  }, [activeRoute, isInspectorModeActive]);

  // Compute local alternative branch features
  const alternativeBranchesFeatures = useMemo(() => {
    if (!isInspectorModeActive || !selectedNodeId || !graph || inspectorBranches.length === 0) {
      return [];
    }
    const sourceNode = graph.nodes.get(selectedNodeId)?.node;
    if (!sourceNode) return [];

    const features: PathSegmentFeature[] = [];

    // Filter out branches that are already part of the chosen path
    const chosenRouteNodeIds = activeRoute?.result?.pathNodeIds ?? [];
    const sourceIdx = chosenRouteNodeIds.indexOf(selectedNodeId);
    const chosenNextNodeId = sourceIdx !== -1 ? chosenRouteNodeIds[sourceIdx + 1] : null;

    inspectorBranches.forEach((ev) => {
      if (ev.targetId === chosenNextNodeId) return;

      const targetNode = graph.nodes.get(ev.targetId)?.node;
      if (!targetNode) return;

      const coords =
        ev.altCoordinates && ev.altCoordinates.length >= 2
          ? ev.altCoordinates.map((c) => [c.lng, c.lat])
          : [
              [sourceNode.lng, sourceNode.lat],
              [targetNode.lng, targetNode.lat],
            ];

      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
        properties: {
          color: PALETTES.alternative,
          infrastructureType: ev.matchedSign,
          roadType: ev.matchedRoad,
          surface: ev.surface || null,
          isChosenPath: false,
          sourceId: selectedNodeId,
          targetId: ev.targetId,
        },
      });
    });

    return features;
  }, [isInspectorModeActive, selectedNodeId, graph, inspectorBranches, activeRoute]);

  // Highlighted path features
  const activeAlternativeTargetId = hoveredAlternativeTargetId || selectedAlternativeTargetId;
  const highlightedFeatures = useMemo(() => {
    if (!isInspectorModeActive || !activeAlternativeTargetId || !selectedNodeId) return [];
    const lockedEval = inspectorBranches.find((ev) => ev.targetId === activeAlternativeTargetId);
    if (lockedEval && lockedEval.altCoordinates) {
      return [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: lockedEval.altCoordinates.map((c) => [c.lng, c.lat]),
          },
          properties: {
            color: PALETTES.alternative,
            isChosenPath: false,
          },
        } as PathSegmentFeature,
      ];
    }
    return [];
  }, [isInspectorModeActive, activeAlternativeTargetId, selectedNodeId, inspectorBranches]);

  // Event handlers for alternative path layers
  const handlePathHover = (properties: Record<string, unknown>, lngLat: [number, number]) => {
    if (!map || !popupRef.current) return;

    const targetId = typeof properties.targetId === 'string' ? properties.targetId : '';
    const isChosen = properties.isChosenPath === true;
    const activeLabel = activeAlternativeLabelRef.current;

    const activeRouteVal = routeVariantsRef.current.find((a) => a.label === activeLabel);
    const pathNodeIds = activeRouteVal?.result?.pathNodeIds ?? [];
    const evaluations = inspectorBranchesRef.current;
    const hoveredEval = evaluations?.find((ev) => ev.targetId === targetId);

    if (hoveredEval) {
      const sourceId = typeof properties.sourceId === 'string' ? properties.sourceId : '';
      const nextNodeId = pathNodeIds[pathNodeIds.indexOf(sourceId) + 1];
      const chosenEval = evaluations?.find((ev) => ev.targetId === nextNodeId);

      const isChosenPath = isChosen;
      const chosenRemainingDuration =
        hoveredEval.chosenRemainingDuration ?? chosenEval?.chosenRemainingDuration ?? 0;
      const chosenRemainingDistance =
        hoveredEval.chosenRemainingDistance ?? chosenEval?.chosenRemainingDistance ?? 0;
      const chosenRemainingSignals =
        hoveredEval.chosenRemainingSignals ?? chosenEval?.chosenRemainingSignals ?? 0;

      let penaltiesHtml = '';
      if (hoveredEval.rulePenalties && hoveredEval.rulePenalties.length > 0) {
        const listItems = hoveredEval.rulePenalties
          .map((p) => {
            let badgeColor = '#ea580c';
            if (p.type === 'restriction') badgeColor = '#ef4444';
            else if (p.type === 'node_delay') badgeColor = '#3b82f6';
            else if (p.type === 'surface') badgeColor = '#ec4899';
            else if (p.type === 'road_class') badgeColor = '#6366f1';
            else if (p.type === 'service') badgeColor = '#a855f7';

            return `<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px; font-size: 10px;">
              <span style="color: rgba(255,255,255,0.7); display: inline-flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${badgeColor};"></span>
                ${p.name}
              </span>
              <span style="font-weight: bold; color: ${badgeColor};">+${Math.round(p.value)}s</span>
            </div>`;
          })
          .join('');
        penaltiesHtml = `
          <div style="margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
            <div style="font-weight: 600; font-size: 10px; color: var(--ciclista-color-text-secondary); margin-bottom: 2px;">Active Rules:</div>
            ${listItems}
          </div>
        `;
      }

      let contentHtml: string;
      if (isChosenPath) {
        contentHtml = `
          <div style="font-family: inherit; font-size: 11px; line-height: 1.4; color: var(--ciclista-color-text-primary);">
            <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px; color: #10b981;">
              ${hoveredEval.name} (Chosen Path)
            </div>
            <div><strong>Remaining Time:</strong> ${Math.round(chosenRemainingDuration)}s</div>
            <div><strong>Remaining Dist:</strong> ${Math.round(chosenRemainingDistance)}m</div>
            <div><strong>Remaining Signals:</strong> ${chosenRemainingSignals}</div>
            <div><strong>Speed:</strong> ${hoveredEval.effectiveSpeedKmh.toFixed(1)} km/h</div>
            <div><strong>Comfort:</strong> ${hoveredEval.comfort}</div>
            ${penaltiesHtml}
          </div>
        `;
      } else {
        const timeDiff = Math.round(
          (hoveredEval.altDurationSeconds ?? hoveredEval.displayCostSeconds) -
            chosenRemainingDuration,
        );
        const distDiff = Math.round(
          (hoveredEval.altDistanceMeters ?? hoveredEval.distance) - chosenRemainingDistance,
        );
        const signalsDiff = (hoveredEval.altSignalCount ?? 0) - chosenRemainingSignals;

        const timeSign = timeDiff >= 0 ? `+${timeDiff}` : `${timeDiff}`;
        const distSign = distDiff >= 0 ? `+${distDiff}` : `${distDiff}`;
        const signalsSign = signalsDiff >= 0 ? `+${signalsDiff}` : `${signalsDiff}`;

        contentHtml = `
          <div style="font-family: inherit; font-size: 11px; line-height: 1.4; color: var(--ciclista-color-text-primary);">
            <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px; color: #f97316;">
              ${hoveredEval.name} (Alternative)
            </div>
            <div><strong>Total Time:</strong> ${timeSign}s</div>
            <div><strong>Total Distance:</strong> ${distSign}m</div>
            <div><strong>Total Signals:</strong> ${signalsSign}</div>
            <div><strong>Speed:</strong> ${hoveredEval.effectiveSpeedKmh.toFixed(1)} km/h</div>
            <div><strong>Comfort:</strong> ${hoveredEval.comfort}</div>
            ${penaltiesHtml}
          </div>
        `;
      }

      setHoveredAlternativeTargetId(isChosenPath ? null : targetId);

      popupRef.current?.setLngLat(lngLat).setHTML(contentHtml).addTo(map);
    }
  };

  const handlePathLeave = () => {
    setHoveredAlternativeTargetId(null);
    if (popupRef.current) {
      popupRef.current.remove();
    }
  };

  const handlePathClick = (properties: Record<string, unknown>) => {
    const isChosen = properties.isChosenPath === true;
    if (!isChosen) {
      const sourceId = typeof properties.sourceId === 'string' ? properties.sourceId : null;
      const targetId = typeof properties.targetId === 'string' ? properties.targetId : null;
      setSelectedNodeIdRef.current(sourceId);
      const currentSelected = selectedAlternativeTargetIdRef.current;
      setSelectedAlternativeTargetIdRef.current(currentSelected === targetId ? null : targetId);
    }
  };

  return (
    <>
      {/* Chosen Path Segments Layer */}
      <UnifiedPathLayer
        id="inspector-chosen-path"
        features={chosenPathFeatures}
        color={PALETTES.semantic.acceptable}
        styleConfig={{
          width: 6,
          opacity: 1.0,
        }}
        useSemanticColors={true}
        visible={isInspectorModeActive}
        onPathHover={handlePathHover}
        onPathLeave={handlePathLeave}
        onPathClick={handlePathClick}
      />

      {/* Local Alternative Branches Layer */}
      <UnifiedPathLayer
        id="inspector-alternative-branches"
        features={alternativeBranchesFeatures}
        color={PALETTES.alternative}
        styleConfig={{
          width: 4,
          opacity: 0.6,
          dashArray: [3, 2],
        }}
        useSemanticColors={false}
        visible={isInspectorModeActive}
        onPathHover={handlePathHover}
        onPathLeave={handlePathLeave}
        onPathClick={handlePathClick}
      />

      {/* Highlighted locked / hovered Alternative Branch */}
      <UnifiedPathLayer
        id="inspector-highlighted-path"
        features={highlightedFeatures}
        color={PALETTES.alternative}
        styleConfig={{
          width: 5,
          opacity: 1.0,
          dashArray: [2, 2],
        }}
        useSemanticColors={false}
        visible={isInspectorModeActive}
      />
    </>
  );
};
