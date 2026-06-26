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

/**
 * The classification of events or controls at nodes.
 */
export type PathNodeType = 'stop' | 'yield' | 'signal' | 'crossing' | 'turn';

/**
 * Properties for a GeoJSON Point feature representing a node event.
 */
export interface PathNodeFeatureProperties {
  type: PathNodeType;
  turnDirection?: string;
  bearing?: number;
  [key: string]: unknown;
}

/**
 * A GeoJSON Point feature representing a node event.
 */
export interface PathNodeFeature extends GeoJSONFeature {
  geometry: {
    type: 'Point';
    coordinates: number[];
  };
  properties: PathNodeFeatureProperties;
}
