import maplibregl from 'maplibre-gl';
import React, { useEffect } from 'react';

import { buildSegmentedPathGeoJSON } from '../../core/rendering/geometry-mapper';
import { INACTIVE_STRATEGY_COLORS, STRATEGY_COLORS } from '../../core/rendering/theme';
import type { PathStyleConfig } from '../../core/rendering/types';
import { UnifiedPathLayer } from './layers/UnifiedPathLayer';
import { useMapContext } from './MapContext';

/**
 * Map overlay layer that renders all computed routing path variants (Standard, Avoid Stops, Quiet Streets).
 * Handles pathway styling, route highlight glows, hover effects, and selection click listeners.
 */
export const RouteVariantsLayer: React.FC = () => {
  const {
    map,
    routeVariants,
    activeAlternativeLabel,
    onSelectAlternative,
    shouldFitBounds,
    setShouldFitBounds,
    isNavigating,
    isInspectorModeActive,
  } = useMapContext();

  // Fit map bounds to show full route path smoothly (using active selection coordinates)
  useEffect(() => {
    if (!map) return;

    const activeRoute = routeVariants.find((a) => a.label === activeAlternativeLabel);
    if (activeRoute && activeRoute.result && activeRoute.result.coordinates.length > 0) {
      const coords = activeRoute.result.coordinates.map((c) => [c.lng, c.lat]);
      if (shouldFitBounds && coords.length > 1 && !isNavigating) {
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
  }, [
    map,
    routeVariants,
    activeAlternativeLabel,
    shouldFitBounds,
    setShouldFitBounds,
    isNavigating,
  ]);

  if (!map) return null;

  const strategies = ['standard', 'avoid-stops', 'quiet-streets'] as const;
  const referenceLayer = map.getLayer('traffic-lights-cluster')
    ? 'traffic-lights-cluster'
    : undefined;

  return (
    <>
      {strategies.map((strategy) => {
        const variant = routeVariants.find((v) => v.label === strategy);
        if (!variant || !variant.result) return null;

        const isActive = activeAlternativeLabel === strategy;
        const features = buildSegmentedPathGeoJSON(variant.result).features;

        // styling configurations derived from strategy status
        const opacity = isActive ? 1.0 : isNavigating ? 0.0 : 0.4;
        const width = isActive ? (isNavigating ? 8 : 6) : 4;
        const glowWidth = isActive ? (isNavigating ? 14 : 9) : 9;
        const glowOpacity = isActive ? (isNavigating ? 0.35 : 0.3) : 0.0;

        const styleConfig: PathStyleConfig = {
          width,
          opacity,
          glowWidth,
          glowOpacity,
        };

        const color = isActive ? STRATEGY_COLORS[strategy] : INACTIVE_STRATEGY_COLORS[strategy];

        return (
          <UnifiedPathLayer
            key={strategy}
            id={strategy}
            features={features}
            styleConfig={styleConfig}
            color={color}
            useSemanticColors={isActive}
            visible={!isInspectorModeActive}
            beforeId={referenceLayer}
            onPathClick={() => {
              if (!isInspectorModeActive) {
                onSelectAlternative(strategy);
              }
            }}
          />
        );
      })}
    </>
  );
};
