import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

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
  } = useMapContext();

  const setSelectedNodeIdRef = useRef(setSelectedNodeId);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const routeAlternativesRef = useRef(routeAlternatives);
  const activeAlternativeLabelRef = useRef(activeAlternativeLabel);

  useEffect(() => {
    setSelectedNodeIdRef.current = setSelectedNodeId;
    selectedNodeIdRef.current = selectedNodeId;
    routeAlternativesRef.current = routeAlternatives;
    activeAlternativeLabelRef.current = activeAlternativeLabel;
  }, [setSelectedNodeId, selectedNodeId, routeAlternatives, activeAlternativeLabel]);

  // Setup layers and sources
  useEffect(() => {
    if (!map) return;

    // inspector-nodes source
    if (!map.getSource('inspector-nodes')) {
      map.addSource('inspector-nodes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // inspector-nodes-layer
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

    // inspector-alternatives source
    if (!map.getSource('inspector-alternatives')) {
      map.addSource('inspector-alternatives', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // inspector-alternatives-layer
    if (!map.getLayer('inspector-alternatives-layer')) {
      map.addLayer({
        id: 'inspector-alternatives-layer',
        type: 'line',
        source: 'inspector-alternatives',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['case', ['get', 'isChosen'], '#10b981', '#ef4444'],
          'line-width': 4,
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
        const targetId = feature.properties.targetId;
        const selNodeId = selectedNodeIdRef.current;
        const alts = routeAlternativesRef.current;
        const activeLabel = activeAlternativeLabelRef.current;

        const activeRoute = alts.find((a) => a.label === activeLabel);
        const pathNodeIds = activeRoute?.result?.pathNodeIds ?? [];
        const evaluations = activeRoute?.result?.alternativeEvaluations?.[selNodeId ?? ''];
        const hoveredEval = evaluations?.find((ev) => ev.targetId === targetId);

        if (hoveredEval) {
          const nextNodeId = pathNodeIds[pathNodeIds.indexOf(selNodeId ?? '') + 1];
          const chosenEval = evaluations?.find((ev) => ev.targetId === nextNodeId);

          let contentHtml = '';
          if (hoveredEval.targetId === nextNodeId) {
            contentHtml = `
              <div style="font-family: inherit; font-size: 11px; line-height: 1.4; color: var(--ciclista-color-text-primary);">
                <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px; color: #10b981;">
                  ${hoveredEval.name} (Chosen Path)
                </div>
                <div><strong>Time:</strong> ${Math.round(hoveredEval.displayCostSeconds)}s</div>
                <div><strong>Distance:</strong> ${Math.round(hoveredEval.distance)}m</div>
                <div><strong>Speed:</strong> ${hoveredEval.effectiveSpeedKmh.toFixed(1)} km/h</div>
                <div><strong>Comfort:</strong> ${hoveredEval.comfort}</div>
              </div>
            `;
          } else if (chosenEval) {
            const timeDiff = Math.round(
              hoveredEval.displayCostSeconds - chosenEval.displayCostSeconds,
            );
            const distDiff = Math.round(hoveredEval.distance - chosenEval.distance);
            const timeSign = timeDiff >= 0 ? `+${timeDiff}` : `${timeDiff}`;
            const distSign = distDiff >= 0 ? `+${distDiff}` : `${distDiff}`;

            contentHtml = `
              <div style="font-family: inherit; font-size: 11px; line-height: 1.4; color: var(--ciclista-color-text-primary);">
                <div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px; color: #ef4444;">
                  ${hoveredEval.name}
                </div>
                <div><strong>Time:</strong> ${timeSign}s</div>
                <div><strong>Distance:</strong> ${distSign}m</div>
                <div><strong>Speed:</strong> ${hoveredEval.effectiveSpeedKmh.toFixed(1)} km/h</div>
                <div><strong>Comfort:</strong> ${hoveredEval.comfort}</div>
              </div>
            `;
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
    };

    map.on('mousemove', 'inspector-nodes-layer', onMouseMove);
    map.on('mouseleave', 'inspector-nodes-layer', onMouseLeave);
    map.on('click', 'inspector-nodes-layer', onClick);
    map.on('mousemove', 'inspector-alternatives-layer', onAltMouseMove);
    map.on('mouseleave', 'inspector-alternatives-layer', onAltMouseLeave);

    return () => {
      map.off('mousemove', 'inspector-nodes-layer', onMouseMove);
      map.off('mouseleave', 'inspector-nodes-layer', onMouseLeave);
      map.off('click', 'inspector-nodes-layer', onClick);
      map.off('mousemove', 'inspector-alternatives-layer', onAltMouseMove);
      map.off('mouseleave', 'inspector-alternatives-layer', onAltMouseLeave);
      popup.remove();

      if (map.getLayer('inspector-nodes-layer')) map.removeLayer('inspector-nodes-layer');
      if (map.getSource('inspector-nodes')) map.removeSource('inspector-nodes');

      if (map.getLayer('inspector-alternatives-layer'))
        map.removeLayer('inspector-alternatives-layer');
      if (map.getSource('inspector-alternatives')) map.removeSource('inspector-alternatives');

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
    const alternativesSource = map.getSource('inspector-alternatives') as maplibregl.GeoJSONSource;
    const labelsSource = map.getSource('inspector-alternative-labels') as maplibregl.GeoJSONSource;

    if (!isInspectorModeActive || pathNodeIds.length === 0) {
      if (nodesSource) nodesSource.setData({ type: 'FeatureCollection', features: [] });
      if (alternativesSource)
        alternativesSource.setData({ type: 'FeatureCollection', features: [] });
      if (labelsSource) labelsSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // 1. Nodes GeoJSON
    const nodeFeatures = pathNodeIds
      .map((nodeId, idx) => {
        const entry = graph?.nodes.get(nodeId);
        if (!entry) return null;
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

    // 2. Alternative Edges GeoJSON
    if (selectedNodeId && graph && activeRoute?.result?.alternativeEvaluations?.[selectedNodeId]) {
      const evaluations = activeRoute.result.alternativeEvaluations[selectedNodeId];
      const nextNodeId = pathNodeIds[pathNodeIds.indexOf(selectedNodeId) + 1];

      const startNode = graph.nodes.get(selectedNodeId)?.node;
      if (startNode) {
        const lineFeatures: Array<{
          type: 'Feature';
          geometry: {
            type: 'LineString';
            coordinates: number[][];
          };
          properties: {
            targetId: string;
            isChosen: boolean;
          };
        }> = [];
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

          const isChosen = ev.targetId === nextNodeId;

          lineFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [startNode.lng, startNode.lat],
                [endNode.lng, endNode.lat],
              ],
            },
            properties: {
              targetId: ev.targetId,
              isChosen,
            },
          });

          const midLng = (startNode.lng + endNode.lng) / 2;
          const midLat = (startNode.lat + endNode.lat) / 2;
          labelFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [midLng, midLat],
            },
            properties: {
              name: ev.name,
            },
          });
        });

        if (alternativesSource) {
          alternativesSource.setData({
            type: 'FeatureCollection',
            features: lineFeatures,
          });
        }
        if (labelsSource) {
          labelsSource.setData({
            type: 'FeatureCollection',
            features: labelFeatures,
          });
        }
      } else {
        if (alternativesSource)
          alternativesSource.setData({ type: 'FeatureCollection', features: [] });
        if (labelsSource) labelsSource.setData({ type: 'FeatureCollection', features: [] });
      }
    } else {
      if (alternativesSource)
        alternativesSource.setData({ type: 'FeatureCollection', features: [] });
      if (labelsSource) labelsSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [
    map,
    graph,
    isInspectorModeActive,
    selectedNodeId,
    routeAlternatives,
    activeAlternativeLabel,
  ]);

  return null;
};
