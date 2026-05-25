import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

import { useMapContext } from './MapContext';

/**
 * Map overlay layer that renders all computed routing path alternatives (Standard, Avoid Stops, Quiet Streets).
 * Handles pathway styling, route highlight glows, hover effects, and selection click listeners.
 */
export const RouteAlternativesLayer: React.FC = () => {
  const {
    map,
    routeAlternatives,
    activeAlternativeLabel,
    onSelectAlternative,
    shouldFitBounds,
    setShouldFitBounds,
  } = useMapContext();

  const onSelectAlternativeRef = useRef(onSelectAlternative);

  useEffect(() => {
    onSelectAlternativeRef.current = onSelectAlternative;
  }, [onSelectAlternative]);

  // Setup layers and sources
  useEffect(() => {
    if (!map) return;
    const strategies = ['standard', 'avoid-stops', 'quiet-streets'] as const;

    strategies.forEach((strategy) => {
      const sourceId = `route-path-${strategy}`;
      const layerId = `route-path-layer-${strategy}`;
      const glowId = `route-path-glow-${strategy}`;

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }

      const colors = {
        standard: '#6366f1',
        'avoid-stops': '#f43f5e',
        'quiet-streets': '#14b8a6',
      };

      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': colors[strategy],
            'line-width': 5,
            'line-opacity': 0.4,
          },
        });
      }

      if (!map.getLayer(glowId)) {
        map.addLayer(
          {
            id: glowId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': colors[strategy],
              'line-width': 9,
              'line-opacity': 0.0,
            },
          },
          layerId, // Draw glow underneath the core route line
        );
      }
    });

    // Hover cursors
    const setPointerCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const resetCursor = () => {
      map.getCanvas().style.cursor = '';
    };

    strategies.forEach((strategy) => {
      const layerId = `route-path-layer-${strategy}`;
      map.on('mouseenter', layerId, setPointerCursor);
      map.on('mouseleave', layerId, resetCursor);
    });

    // Click triggers
    const handleStandardClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      onSelectAlternativeRef.current('standard');
    };
    const handleAvoidStopsClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      onSelectAlternativeRef.current('avoid-stops');
    };
    const handleQuietStreetsClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      onSelectAlternativeRef.current('quiet-streets');
    };

    map.on('click', 'route-path-layer-standard', handleStandardClick);
    map.on('click', 'route-path-layer-avoid-stops', handleAvoidStopsClick);
    map.on('click', 'route-path-layer-quiet-streets', handleQuietStreetsClick);

    return () => {
      strategies.forEach((strategy) => {
        const layerId = `route-path-layer-${strategy}`;
        const glowId = `route-path-glow-${strategy}`;
        const sourceId = `route-path-${strategy}`;

        map.off('mouseenter', layerId, setPointerCursor);
        map.off('mouseleave', layerId, resetCursor);

        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getLayer(glowId)) map.removeLayer(glowId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });

      map.off('click', 'route-path-layer-standard', handleStandardClick);
      map.off('click', 'route-path-layer-avoid-stops', handleAvoidStopsClick);
      map.off('click', 'route-path-layer-quiet-streets', handleQuietStreetsClick);
    };
  }, [map]);

  // Synchronize route lines & opacities & fitbounds
  useEffect(() => {
    if (!map) return;
    const strategies = ['standard', 'avoid-stops', 'quiet-streets'] as const;

    strategies.forEach((strategy) => {
      const source = map.getSource(`route-path-${strategy}`) as maplibregl.GeoJSONSource;
      if (!source) return;

      const alt = routeAlternatives.find((a) => a.label === strategy);
      if (alt && alt.result && alt.result.coordinates.length > 0) {
        const coords = alt.result.coordinates.map((c) => [c.lng, c.lat]);
        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: coords,
              },
              properties: {},
            },
          ],
        });
      } else {
        source.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }

      // Update styling dynamically based on active selection
      const isActive = activeAlternativeLabel === strategy;
      if (map.getLayer(`route-path-layer-${strategy}`)) {
        map.setPaintProperty(`route-path-layer-${strategy}`, 'line-opacity', isActive ? 1.0 : 0.4);
        map.setPaintProperty(`route-path-layer-${strategy}`, 'line-width', isActive ? 6 : 4);
      }
      if (map.getLayer(`route-path-glow-${strategy}`)) {
        map.setPaintProperty(`route-path-glow-${strategy}`, 'line-opacity', isActive ? 0.3 : 0.0);
      }

      // Bring active layer to front (under the traffic lights layer)
      if (isActive) {
        const referenceLayer = map.getLayer('traffic-lights-cluster')
          ? 'traffic-lights-cluster'
          : undefined;

        if (map.getLayer(`route-path-glow-${strategy}`)) {
          map.moveLayer(`route-path-glow-${strategy}`, referenceLayer);
        }
        if (map.getLayer(`route-path-layer-${strategy}`)) {
          map.moveLayer(`route-path-layer-${strategy}`, referenceLayer);
        }
      }
    });

    // Fit map bounds to show full route path smoothly (using active selection coordinates)
    const activeRoute = routeAlternatives.find((a) => a.label === activeAlternativeLabel);
    if (activeRoute && activeRoute.result && activeRoute.result.coordinates.length > 0) {
      const coords = activeRoute.result.coordinates.map((c) => [c.lng, c.lat]);
      if (shouldFitBounds && coords.length > 1) {
        const bounds = coords.reduce(
          (acc, val) => acc.extend(val as [number, number]),
          new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]),
        );
        const isMobile = window.innerWidth <= 768;
        const padding = isMobile
          ? {
              top: 40,
              bottom: window.innerHeight * 0.45 + 40,
              left: 20,
              right: 20,
            }
          : 50;
        map.fitBounds(bounds, { padding, maxZoom: 16 });

        setShouldFitBounds(false);
      }
    }
  }, [map, routeAlternatives, activeAlternativeLabel, shouldFitBounds, setShouldFitBounds]);

  return null;
};
