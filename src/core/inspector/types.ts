import type { GeoJSONFeature } from '../graph/geojson';

/**
 * Properties for the GeoJSON features representing path segments in inspector mode.
 */
export interface InspectorRouteSegmentProperties {
  /**
   * Hex color of the segment based on infrastructure type.
   */
  color: string;
  /**
   * The mapped infrastructure type of the segment (e.g. segregated path, sidewalk).
   */
  infrastructureType: string | null;
  /**
   * The road type classification of the segment.
   */
  roadType: string;
  /**
   * The surface type of the segment.
   */
  surface: string | null;
  /**
   * True if the segment is part of the chosen main path, false if it's an alternative.
   */
  isChosenPath: boolean;
  /**
   * The start node ID of this segment.
   */
  sourceId?: string;
  /**
   * The end node ID of this segment.
   */
  targetId?: string;
}

/**
 * A GeoJSON LineString feature representing a single path segment in inspector mode.
 */
export interface InspectorRouteSegment extends GeoJSONFeature {
  /**
   * The LineString geometry.
   */
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
  /**
   * The segment properties.
   */
  properties: InspectorRouteSegmentProperties;
}

/**
 * The classification of events or controls at nodes.
 */
export type InspectorNodeType = 'stop' | 'yield' | 'signal' | 'crossing' | 'turn';

/**
 * Properties for a GeoJSON Point feature representing a node event in inspector mode.
 */
export interface InspectorNodeFeatureProperties {
  /**
   * The type of control or event at the node.
   */
  type: InspectorNodeType;
  /**
   * The direction of the turn, if type is 'turn'.
   */
  turnDirection?: string;
  /**
   * The angle/bearing for symbol rotation.
   */
  bearing?: number;
}

/**
 * A GeoJSON Point feature representing a node event in inspector mode.
 */
export interface InspectorNodeFeature extends GeoJSONFeature {
  /**
   * The Point geometry.
   */
  geometry: {
    type: 'Point';
    coordinates: number[];
  };
  /**
   * The node feature properties.
   */
  properties: InspectorNodeFeatureProperties;
}
