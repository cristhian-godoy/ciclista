import type { GeoJSONFeature } from '../graph/geojson';

/**
 * Semantic properties for a rendered path segment.
 */
export interface PathSegmentProperties {
  color: string;
  infrastructureType?: string | null;
  roadType?: string;
  surface?: string | null;
  isChosenPath?: boolean;
  sourceId?: string;
  targetId?: string;
  [key: string]: unknown;
}

/**
 * A GeoJSON Feature representing a single line segment of a path.
 */
export interface PathSegmentFeature extends GeoJSONFeature {
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
  properties: PathSegmentProperties;
}

/**
 * Styling configuration for a path rendering layer.
 */
export interface PathStyleConfig {
  width: number;
  opacity: number;
  glowWidth?: number;
  glowOpacity?: number;
  dashArray?: number[];
  zIndex?: number;
}
