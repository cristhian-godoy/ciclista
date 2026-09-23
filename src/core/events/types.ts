/**
 * Supported map event types.
 */
export type MapEventType = 'road_blockage';

/**
 * Routing effect parameters applied when a road blockage event is active.
 */
export interface RoadBlockageEffect {
  type: 'road_blockage';
  penaltySeconds: number;
}

/**
 * Union of all map event effects that can influence routing and rendering.
 */
export type MapEventEffect = RoadBlockageEffect;

/**
 * Domain entity representing a temporal or user-defined event impacting graph edges.
 */
export interface MapEvent {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  edgeIds: string[];
  effect: MapEventEffect;
  createdAt: number;
}
