import type maplibregl from 'maplibre-gl';
import React, { useEffect } from 'react';

import type { PathSegmentFeature, PathStyleConfig } from '../../../core/rendering/types';
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

  const sourceId = `route-path-source-${id}`;
  const glowId = `route-path-glow-${id}`;
  const coreId = `route-path-core-${id}`;
  const semanticId = `route-path-semantic-${id}`;

  // 1. Manage Source and Layers lifecycle
  useEffect(() => {
    if (!map) return;

    // Add source if not present
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // Glow layer (bottom)
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
            'line-color': '#000',
            'line-width': 1,
            'line-opacity': 0,
          },
        },
        beforeId,
      );
    }

    // Core layer (middle)
    if (!map.getLayer(coreId)) {
      map.addLayer(
        {
          id: coreId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#000',
            'line-width': 1,
            'line-opacity': 0,
          },
        },
        beforeId,
      );
    }

    // Semantic layer (top)
    if (!map.getLayer(semanticId)) {
      map.addLayer(
        {
          id: semanticId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#3b82f6'],
            'line-width': 1,
            'line-opacity': 0,
          },
        },
        beforeId,
      );
    }

    return () => {
      if (map.getLayer(glowId)) map.removeLayer(glowId);
      if (map.getLayer(coreId)) map.removeLayer(coreId);
      if (map.getLayer(semanticId)) map.removeLayer(semanticId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, sourceId, glowId, coreId, semanticId, beforeId]);

  // 2. Synchronize Source GeoJSON Data
  useEffect(() => {
    if (!map) return;
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features,
      });
    }
  }, [map, sourceId, features]);

  // 3. Synchronize Styles and Visibilities
  useEffect(() => {
    if (!map) return;

    const isVisible = visible !== false;
    const glowVisibility = isVisible ? 'visible' : 'none';
    const coreVisibility = isVisible && !useSemanticColors ? 'visible' : 'none';
    const semanticVisibility = isVisible && useSemanticColors ? 'visible' : 'none';

    if (map.getLayer(glowId)) {
      map.setLayoutProperty(glowId, 'visibility', glowVisibility);
      map.setPaintProperty(glowId, 'line-color', color);
      map.setPaintProperty(glowId, 'line-width', styleConfig.glowWidth ?? 9);
      map.setPaintProperty(glowId, 'line-opacity', styleConfig.glowOpacity ?? 0);
    }

    if (map.getLayer(coreId)) {
      map.setLayoutProperty(coreId, 'visibility', coreVisibility);
      map.setPaintProperty(coreId, 'line-color', color);
      map.setPaintProperty(coreId, 'line-width', styleConfig.width);
      map.setPaintProperty(coreId, 'line-opacity', styleConfig.opacity);
    }

    if (map.getLayer(semanticId)) {
      map.setLayoutProperty(semanticId, 'visibility', semanticVisibility);
      map.setPaintProperty(semanticId, 'line-width', styleConfig.width);
      map.setPaintProperty(semanticId, 'line-opacity', styleConfig.opacity);
    }
  }, [map, glowId, coreId, semanticId, styleConfig, color, useSemanticColors, visible]);

  // 4. Manage Layer Positions
  useEffect(() => {
    if (!map) return;
    if (map.getLayer(glowId)) map.moveLayer(glowId, beforeId);
    if (map.getLayer(coreId)) map.moveLayer(coreId, beforeId);
    if (map.getLayer(semanticId)) map.moveLayer(semanticId, beforeId);
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
        onPathHover(feat.properties || {}, [e.lngLat.lng, e.lngLat.lat]);
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
        onPathClick(e.features[0].properties || {});
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
        if (map.getLayer(layerId)) {
          map.off('mouseenter', layerId, handleMouseEnter);
          map.off('mousemove', layerId, handleMouseMove);
          map.off('mouseleave', layerId, handleMouseLeave);
          map.off('click', layerId, handleClick);
        }
      });
    };
  }, [map, coreId, semanticId, onPathClick, onPathHover, onPathLeave]);

  return null;
};
