import type * as maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo } from 'react';

import { MAP_THEME_TOKENS } from '../../../core/rendering/theme';
import type { PathSegmentFeature, PathStyleConfig } from '../../../core/rendering/types';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../../hooks/useGeoJsonLayer';
import { useMapContext } from '../MapContext';

/**
 * Properties for the UnifiedPathLayer component.
 */
export interface UnifiedPathLayerProps {
  /** Unique identifier prefix for the layers and sources */
  id: string;
  /** GeoJSON path segments to render */
  features: PathSegmentFeature[];
  /** Styling configurations like width, opacity, glow */
  styleConfig: PathStyleConfig;
  /** Primary fallback/strategy color for the core and glow line paths */
  color: string;
  /** Whether to enable per-segment semantic coloring using GeoJSON properties */
  useSemanticColors?: boolean;
  /** Controlling visibility of the entire path layer */
  visible?: boolean;
  /** Optional layer ID to render this path layer underneath */
  beforeId?: string;
  /** Callback fired when a path segment is clicked */
  onPathClick?: (properties: Record<string, unknown>) => void;
  /** Callback fired when a path segment is hovered */
  onPathHover?: (properties: Record<string, unknown>, lngLat: [number, number]) => void;
  /** Callback fired when the cursor leaves the path segments */
  onPathLeave?: () => void;
}

/**
 * Unified path rendering layer that manages three MapLibre GL layers:
 * 1. Glow layer (bottom, highlighting active route variants)
 * 2. Core Path layer (middle, rendering the single strategy color path)
 * 3. Semantic Segment layer (top, rendering semantic coloring per OSM metadata)
 */
export const UnifiedPathLayer: React.FC<UnifiedPathLayerProps> = ({
  id,
  features,
  styleConfig,
  color,
  useSemanticColors = false,
  visible = true,
  beforeId,
  onPathClick,
  onPathHover,
  onPathLeave,
}) => {
  const { map } = useMapContext();

  const sourceSegmentedId = `route-path-source-segmented-${id}`;
  const sourceContinuousId = `route-path-source-continuous-${id}`;
  const glowId = `route-path-glow-${id}`;
  const coreId = `route-path-core-${id}`;
  const semanticId = `route-path-semantic-${id}`;

  // Build continuous line features to prevent overlapping joint dots on non-opaque/glow lines
  const continuousFeatures = useMemo(() => {
    if (features.length === 0) return [];

    const coordsList: number[][] = [];
    features.forEach((feat) => {
      if (feat.geometry && feat.geometry.type === 'LineString') {
        feat.geometry.coordinates.forEach((coord) => {
          if (coordsList.length === 0) {
            coordsList.push(coord);
          } else {
            const last = coordsList[coordsList.length - 1];
            if (last && (last[0] !== coord[0] || last[1] !== coord[1])) {
              coordsList.push(coord);
            }
          }
        });
      }
    });

    if (coordsList.length < 2) return [];

    return [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: coordsList,
        },
        properties: {},
      },
    ];
  }, [features]);

  const isVisible = visible !== false;
  const glowVisibility = isVisible ? 'visible' : 'none';
  const coreVisibility = isVisible && !useSemanticColors ? 'visible' : 'none';
  const semanticVisibility = isVisible && useSemanticColors ? 'visible' : 'none';

  const continuousLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: glowId,
        type: 'line',
        source: sourceContinuousId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: glowVisibility,
        },
        paint: {
          'line-color': color,
          'line-width': styleConfig.glowWidth ?? 9,
          'line-opacity': styleConfig.glowOpacity ?? 0,
        },
      },
      {
        id: coreId,
        type: 'line',
        source: sourceContinuousId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: coreVisibility,
        },
        paint: {
          'line-color': color,
          'line-width': styleConfig.width,
          'line-opacity': styleConfig.opacity,
        },
      },
    ],
    [glowId, coreId, sourceContinuousId, glowVisibility, coreVisibility, color, styleConfig],
  );

  const segmentedLayers = useMemo<GeoJsonLayerSpec[]>(
    () => [
      {
        id: semanticId,
        type: 'line',
        source: sourceSegmentedId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: semanticVisibility,
        },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], MAP_THEME_TOKENS.status.info],
          'line-width': styleConfig.width,
          'line-opacity': styleConfig.opacity,
        },
      },
    ],
    [semanticId, sourceSegmentedId, semanticVisibility, styleConfig],
  );

  const continuousGeoJson = useMemo(
    () => ({ type: 'FeatureCollection' as const, features: continuousFeatures }),
    [continuousFeatures],
  );

  const segmentedGeoJson = useMemo(
    () => ({ type: 'FeatureCollection' as const, features }),
    [features],
  );

  useGeoJsonLayer({
    map,
    sourceId: sourceContinuousId,
    layers: continuousLayers,
    beforeId,
    data: continuousGeoJson,
  });

  useGeoJsonLayer({
    map,
    sourceId: sourceSegmentedId,
    layers: segmentedLayers,
    beforeId,
    data: segmentedGeoJson,
  });

  // 4. Manage Layer Positions
  useEffect(() => {
    if (!map) return;
    const safeBeforeId = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
    if (map.getLayer(glowId)) map.moveLayer(glowId, safeBeforeId);
    if (map.getLayer(coreId)) map.moveLayer(coreId, safeBeforeId);
    if (map.getLayer(semanticId)) map.moveLayer(semanticId, safeBeforeId);
  }, [map, glowId, coreId, semanticId, beforeId]);

  // 5. Setup Hover and Click Event Listeners
  useEffect(() => {
    if (!map) return;

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (onPathHover && e.features && e.features.length > 0) {
        const feat = e.features[0];
        if (feat) {
          onPathHover(feat.properties || {}, [e.lngLat.lng, e.lngLat.lat]);
        }
      }
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      if (onPathLeave) {
        onPathLeave();
      }
    };

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (onPathClick && e.features && e.features.length > 0) {
        e.preventDefault();
        const feat = e.features[0];
        if (feat) {
          onPathClick(feat.properties || {});
        }
      }
    };

    const layers = [coreId, semanticId];

    layers.forEach((layerId) => {
      map.on('mouseenter', layerId, handleMouseEnter);
      map.on('mousemove', layerId, handleMouseMove);
      map.on('mouseleave', layerId, handleMouseLeave);
      map.on('click', layerId, handleClick);
    });

    return () => {
      layers.forEach((layerId) => {
        map.off('mouseenter', layerId, handleMouseEnter);
        map.off('mousemove', layerId, handleMouseMove);
        map.off('mouseleave', layerId, handleMouseLeave);
        map.off('click', layerId, handleClick);
      });
    };
  }, [map, coreId, semanticId, onPathClick, onPathHover, onPathLeave]);

  return null;
};
