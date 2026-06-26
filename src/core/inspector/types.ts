import type { Coordinate } from '../common/types';
import type { ComfortLevel } from '../config';
import type { GeoJSONFeature } from '../graph/geojson';
import type { PathNodeFeature, PathNodeFeatureProperties, PathNodeType } from '../rendering/types';

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
  [key: string]: unknown;
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
export type InspectorNodeType = PathNodeType;

/**
 * Properties for a GeoJSON Point feature representing a node event in inspector mode.
 */
export type InspectorNodeFeatureProperties = PathNodeFeatureProperties;

/**
 * A GeoJSON Point feature representing a node event in inspector mode.
 */
export type InspectorNodeFeature = PathNodeFeature;

/**
 * Detailed routing cost and physical impact evaluation for a single graph edge branch.
 */
export interface InspectorBranchEvaluation {
  targetId: string;
  name: string;
  distance: number;
  highway: string;
  baseSpeedKmh: number;
  effectiveSpeedKmh: number;
  surface: 'paved' | 'gravel' | 'cobblestone';
  flatPenaltySeconds: number;
  comfort: ComfortLevel;
  matchedSign: string | null;
  matchedRoad: string;
  routingWeight: number;
  displayCostSeconds: number;
  isRestricted: boolean;
  turnPenaltySeconds: number;
  nodeDelaySeconds: number;
  nodeDelayType: 'signal' | 'yield' | 'stop' | 'crossing' | 'custom' | null;
  restrictionReason: 'footway_not_bicycle_frei' | null;
  rulePenalties?: {
    name: string;
    value: number;
    type: 'turn' | 'node_delay' | 'surface' | 'road_class' | 'restriction' | 'service';
  }[];
  altPathNodeIds?: string[];
  altCoordinates?: Coordinate[];
  altDurationSeconds?: number;
  altDistanceMeters?: number;
  altSignalCount?: number;
  chosenRemainingDuration?: number;
  chosenRemainingDistance?: number;
  chosenRemainingSignals?: number;
}
