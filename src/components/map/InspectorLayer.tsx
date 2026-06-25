import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

import { mapRouteToInspectorGeoJSON } from '../../core/inspector/mapper';
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
    routeAlternatives,
    activeAlternativeLabel,
    selectedAlternativeTargetId,
    setSelectedAlternativeTargetId,
  } = useMapContext();

  const setSelectedNodeIdRef = useRef(setSelectedNodeId);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const routeAlternativesRef = useRef(routeAlternatives);
  const activeAlternativeLabelRef = useRef(activeAlternativeLabel);
  const selectedAlternativeTargetIdRef = useRef(selectedAlternativeTargetId);
  const setSelectedAlternativeTargetIdRef = useRef(setSelectedAlternativeTargetId);

  useEffect(() => {
    setSelectedNodeIdRef.current = setSelectedNodeId;
    selectedNodeIdRef.current = selectedNodeId;
    routeAlternativesRef.current = routeAlternatives;
    activeAlternativeLabelRef.current = activeAlternativeLabel;
    selectedAlternativeTargetIdRef.current = selectedAlternativeTargetId;
    setSelectedAlternativeTargetIdRef.current = setSelectedAlternativeTargetId;
  }, [
    setSelectedNodeId,
    selectedNodeId,
    routeAlternatives,
    activeAlternativeLabel,
    selectedAlternativeTargetId,
    setSelectedAlternativeTargetId,
  ]);

  // Setup layers and sources
  useEffect(() => {
    if (!map) return;

    // inspector-path-segments source
    if (!map.getSource('inspector-path-segments')) {
      map.addSource('inspector-path-segments', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // inspector-path-segments-layer
    if (!map.getLayer('inspector-path-segments-layer')) {
      map.addLayer({
        id: 'inspector-path-segments-layer',
        type: 'line',
        source: 'inspector-path-segments',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['boolean', ['get', 'isChosenPath'], false], 6, 4],
          'line-opacity': ['case', ['boolean', ['get', 'isChosenPath'], false], 1.0, 0.6],
          'line-dasharray': [
            'case',
            ['boolean', ['get', 'isChosenPath'], false],
            ['literal', [1, 0]],
            ['literal', [3, 2]],
          ],
        },
      });
    }

    // inspector-nodes source
    if (!map.getSource('inspector-nodes')) {
      map.addSource('inspector-nodes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // inspector-nodes-layer (interactive circles for click-to-inspect)
    if (!map.getLayer('inspector-nodes-layer')) {
      map.addLayer({
        id: 'inspector-nodes-layer',
        type: 'circle',
        source: 'inspector-nodes',
        paint: {
          'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 9, 6],
          'circle-color': '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
          'circle-stroke-opacity': 0.9,
        },
      });
    }

    // inspector-node-symbols source
    if (!map.getSource('inspector-node-symbols')) {
      map.addSource('inspector-node-symbols', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // inspector-node-symbols-layer (always visible signs: 🛑, 🚦, etc.)
    if (!map.getLayer('inspector-node-symbols-layer')) {
      map.addLayer({
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
            '#eab308',
            'stop',
            '#ef4444',
            'yield',
            '#f97316',
            'crossing',
            '#3b82f6',
            '#ffffff',
          ],
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
      });
    }

    // inspector-turn-arrows source
    if (!map.getSource('inspector-turn-arrows')) {
      map.addSource('inspector-turn-arrows', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // inspector-turn-arrows-layer (always visible sharp turns arrows)
    if (!map.getLayer('inspector-turn-arrows-layer')) {
      map.addLayer({
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
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
      });
    }

    // inspector-highlighted-path source
    if (!map.getSource('inspector-highlighted-path')) {
      map.addSource('inspector-highlighted-path', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // inspector-highlighted-path-layer
    if (!map.getLayer('inspector-highlighted-path-layer')) {
      map.addLayer({
        id: 'inspector-highlighted-path-layer',
        type: 'line',
        source: 'inspector-highlighted-path',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ef4444',
          'line-width': 5,
          'line-dasharray': [2, 2],
        },
      });
    }

    // inspector-alternative-labels source
    if (!map.getSource('inspector-alternative-labels')) {
      map.addSource('inspector-alternative-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // inspector-alternative-labels-layer
    if (!map.getLayer('inspector-alternative-labels-layer')) {
      map.addLayer({
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
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
      });
    }

    let hoveredNodeId: number | null = null;

    const onMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features[0];
        if (hoveredNodeId !== null) {
          map.setFeatureState({ source: 'inspector-nodes', id: hoveredNodeId }, { hover: false });
        }
        hoveredNodeId = feature.id as number;
        map.setFeatureState({ source: 'inspector-nodes', id: hoveredNodeId }, { hover: true });
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

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'inspector-hover-popup',
    });

    const onAltMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features[0];
        const sourceId = feature.properties.sourceId;
        const targetId = feature.properties.targetId;
        const isChosen = feature.properties.isChosenPath;
        const alts = routeAlternativesRef.current;
        const activeLabel = activeAlternativeLabelRef.current;

        const activeRoute = alts.find((a) => a.label === activeLabel);
        const pathNodeIds = activeRoute?.result?.pathNodeIds ?? [];
        const evaluations = activeRoute?.result?.alternativeEvaluations?.[sourceId ?? ''];
        const hoveredEval = evaluations?.find((ev) => ev.targetId === targetId);

        if (hoveredEval) {
          const nextNodeId = pathNodeIds[pathNodeIds.indexOf(sourceId ?? '') + 1];
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
                <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px; color: #ef4444;">
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

          if (!isChosenPath && hoveredEval.altCoordinates) {
            const highlightedSource = map.getSource(
              'inspector-highlighted-path',
            ) as maplibregl.GeoJSONSource;
            if (highlightedSource) {
              highlightedSource.setData({
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: hoveredEval.altCoordinates.map((c) => [c.lng, c.lat]),
                    },
                    properties: {},
                  },
                ],
              });
            }
          } else {
            const highlightedSource = map.getSource(
              'inspector-highlighted-path',
            ) as maplibregl.GeoJSONSource;
            if (highlightedSource) {
              highlightedSource.setData({ type: 'FeatureCollection', features: [] });
            }
          }

          if (contentHtml) {
            popup.setLngLat(e.lngLat).setHTML(contentHtml).addTo(map);
          }
        }
      }
    };

    const onAltMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      popup.remove();

      const highlightedSource = map.getSource(
        'inspector-highlighted-path',
      ) as maplibregl.GeoJSONSource;
      if (highlightedSource) {
        const lockedId = selectedAlternativeTargetIdRef.current;
        const selNodeId = selectedNodeIdRef.current;
        const alts = routeAlternativesRef.current;
        const activeLabel = activeAlternativeLabelRef.current;
        const activeRoute = alts.find((a) => a.label === activeLabel);
        const evaluations = activeRoute?.result?.alternativeEvaluations?.[selNodeId ?? ''];
        const lockedEval = evaluations?.find((ev) => ev.targetId === lockedId);

        if (lockedEval && lockedEval.altCoordinates) {
          highlightedSource.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: lockedEval.altCoordinates.map((c) => [c.lng, c.lat]),
                },
                properties: {},
              },
            ],
          });
        } else {
          highlightedSource.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    };

    const onAltClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      if (e.features && e.features.length > 0) {
        const sourceId = e.features[0].properties.sourceId;
        const targetId = e.features[0].properties.targetId;
        const isChosen = e.features[0].properties.isChosenPath;
        if (!isChosen) {
          setSelectedNodeIdRef.current(sourceId);
          const currentSelected = selectedAlternativeTargetIdRef.current;
          setSelectedAlternativeTargetIdRef.current(currentSelected === targetId ? null : targetId);
        }
      }
    };

    map.on('mousemove', 'inspector-nodes-layer', onMouseMove);
    map.on('mouseleave', 'inspector-nodes-layer', onMouseLeave);
    map.on('click', 'inspector-nodes-layer', onClick);
    map.on('mousemove', 'inspector-path-segments-layer', onAltMouseMove);
    map.on('mouseleave', 'inspector-path-segments-layer', onAltMouseLeave);
    map.on('click', 'inspector-path-segments-layer', onAltClick);

    return () => {
      map.off('mousemove', 'inspector-nodes-layer', onMouseMove);
      map.off('mouseleave', 'inspector-nodes-layer', onMouseLeave);
      map.off('click', 'inspector-nodes-layer', onClick);
      map.off('mousemove', 'inspector-path-segments-layer', onAltMouseMove);
      map.off('mouseleave', 'inspector-path-segments-layer', onAltMouseLeave);
      map.off('click', 'inspector-path-segments-layer', onAltClick);
      popup.remove();

      if (map.getLayer('inspector-nodes-layer')) map.removeLayer('inspector-nodes-layer');
      if (map.getSource('inspector-nodes')) map.removeSource('inspector-nodes');

      if (map.getLayer('inspector-path-segments-layer'))
        map.removeLayer('inspector-path-segments-layer');
      if (map.getSource('inspector-path-segments')) map.removeSource('inspector-path-segments');

      if (map.getLayer('inspector-node-symbols-layer'))
        map.removeLayer('inspector-node-symbols-layer');
      if (map.getSource('inspector-node-symbols')) map.removeSource('inspector-node-symbols');

      if (map.getLayer('inspector-turn-arrows-layer'))
        map.removeLayer('inspector-turn-arrows-layer');
      if (map.getSource('inspector-turn-arrows')) map.removeSource('inspector-turn-arrows');

      if (map.getLayer('inspector-highlighted-path-layer'))
        map.removeLayer('inspector-highlighted-path-layer');
      if (map.getSource('inspector-highlighted-path'))
        map.removeSource('inspector-highlighted-path');

      if (map.getLayer('inspector-alternative-labels-layer'))
        map.removeLayer('inspector-alternative-labels-layer');
      if (map.getSource('inspector-alternative-labels'))
        map.removeSource('inspector-alternative-labels');
    };
  }, [map]);

  // Synchronize geojson data
  useEffect(() => {
    if (!map) return;

    const activeRoute = routeAlternatives.find((a) => a.label === activeAlternativeLabel);
    const pathNodeIds = activeRoute?.result?.pathNodeIds ?? [];

    const nodesSource = map.getSource('inspector-nodes') as maplibregl.GeoJSONSource;
    const segmentsSource = map.getSource('inspector-path-segments') as maplibregl.GeoJSONSource;
    const nodeSymbolsSource = map.getSource('inspector-node-symbols') as maplibregl.GeoJSONSource;
    const turnArrowsSource = map.getSource('inspector-turn-arrows') as maplibregl.GeoJSONSource;
    const labelsSource = map.getSource('inspector-alternative-labels') as maplibregl.GeoJSONSource;
    const highlightedSource = map.getSource(
      'inspector-highlighted-path',
    ) as maplibregl.GeoJSONSource;

    if (!isInspectorModeActive || pathNodeIds.length === 0) {
      if (nodesSource) nodesSource.setData({ type: 'FeatureCollection', features: [] });
      if (segmentsSource) segmentsSource.setData({ type: 'FeatureCollection', features: [] });
      if (nodeSymbolsSource) nodeSymbolsSource.setData({ type: 'FeatureCollection', features: [] });
      if (turnArrowsSource) turnArrowsSource.setData({ type: 'FeatureCollection', features: [] });
      if (labelsSource) labelsSource.setData({ type: 'FeatureCollection', features: [] });
      if (highlightedSource) highlightedSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Run mapper to get unified geojson data
    const geojsonData = mapRouteToInspectorGeoJSON(
      activeRoute.result,
      graph ?? { nodes: new Map() },
      selectedNodeId,
    );

    // 1. Nodes GeoJSON (interactive click points)
    const nodeFeatures = pathNodeIds
      .map((nodeId, idx) => {
        const entry = graph?.nodes.get(nodeId);
        if (!entry) return null;

        const evals = activeRoute?.result?.alternativeEvaluations?.[nodeId] ?? [];
        const nextNodeId = pathNodeIds[idx + 1];
        const alternativeEvals = evals.filter((ev) => ev.targetId !== nextNodeId);

        if (alternativeEvals.length === 0) {
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

    if (nodesSource) {
      nodesSource.setData({
        type: 'FeatureCollection',
        features: nodeFeatures,
      });
    }

    // 2. Set segments data
    if (segmentsSource) {
      segmentsSource.setData(geojsonData.segments);
    }

    // 3. Set node symbols (traffic lights, stops, yields, crossings)
    if (nodeSymbolsSource) {
      nodeSymbolsSource.setData({
        type: 'FeatureCollection',
        features: geojsonData.nodes.features.filter((f) => f.properties.type !== 'turn'),
      });
    }

    // 4. Set turn arrows
    if (turnArrowsSource) {
      turnArrowsSource.setData({
        type: 'FeatureCollection',
        features: geojsonData.nodes.features.filter((f) => f.properties.type === 'turn'),
      });
    }

    // 5. Setup Alternative labels only for selectedNodeId
    if (selectedNodeId && graph && activeRoute?.result?.alternativeEvaluations?.[selectedNodeId]) {
      const evaluations = activeRoute.result.alternativeEvaluations[selectedNodeId];
      const startNode = graph.nodes.get(selectedNodeId)?.node;
      if (startNode) {
        const labelFeatures: Array<{
          type: 'Feature';
          geometry: {
            type: 'Point';
            coordinates: number[];
          };
          properties: {
            name: string;
          };
        }> = [];

        evaluations.forEach((ev) => {
          const endNode = graph.nodes.get(ev.targetId)?.node;
          if (!endNode) return;
          const midLng = (startNode.lng + endNode.lng) / 2;
          const midLat = (startNode.lat + endNode.lat) / 2;
          labelFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point' as const,
              coordinates: [midLng, midLat],
            },
            properties: {
              name: ev.name,
            },
          });
        });

        if (labelsSource) {
          labelsSource.setData({
            type: 'FeatureCollection',
            features: labelFeatures,
          });
        }
      } else {
        if (labelsSource) labelsSource.setData({ type: 'FeatureCollection', features: [] });
      }
    } else {
      if (labelsSource) labelsSource.setData({ type: 'FeatureCollection', features: [] });
    }

    // 6. Highlighted Locked Path GeoJSON
    if (highlightedSource) {
      if (selectedNodeId && selectedAlternativeTargetId) {
        const lockedEval = activeRoute?.result?.alternativeEvaluations?.[selectedNodeId]?.find(
          (ev) => ev.targetId === selectedAlternativeTargetId,
        );
        if (lockedEval && lockedEval.altCoordinates) {
          highlightedSource.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: lockedEval.altCoordinates.map((c) => [c.lng, c.lat]),
                },
                properties: {},
              },
            ],
          });
        } else {
          highlightedSource.setData({ type: 'FeatureCollection', features: [] });
        }
      } else {
        highlightedSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [
    map,
    graph,
    isInspectorModeActive,
    selectedNodeId,
    selectedAlternativeTargetId,
    routeAlternatives,
    activeAlternativeLabel,
  ]);

  return null;
};
