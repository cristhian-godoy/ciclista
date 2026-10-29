import type { BikeProfileId } from './types';

/**
 * Default routing strategy optimization preferences.
 */
export type RoutingStrategyId = 'balanced' | 'fastest' | 'safe' | 'scenic';

/**
 * Global application configuration and user preferences.
 */
export interface AppSettings {
  /** Active UI color theme mode */
  theme: 'bright' | 'liberty' | 'dark';
  /** Whether to freeze/lock start and destination pins from being dragged or placed during edit mode */
  freezePinsOnEditMode: boolean;
  /** Whether to automatically collapse expanded crossing clusters on zoom out or pan */
  autoCollapseCrossingClusters: boolean;
  /** Whether the vector street network graph overlay is visible on the map */
  showStreetGraph: boolean;
  /** Whether individual traffic signals and crossing cluster marker icons are visible */
  showTrafficSignals: boolean;
  /** Restricts automatic background Overpass queries and map tile prefetching */
  dataSaver: boolean;
  /** Controls whether heavy OSM data tiles can be fetched over cellular connections */
  allowCellularDownloads: boolean;
  /** Default bicycle configuration profile applied on load */
  defaultBikeProfile: BikeProfileId;
  /** Default route optimization variant applied on load */
  defaultRoutingStrategy: RoutingStrategyId;
}

/**
 * Default application settings fallback configuration.
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'bright',
  freezePinsOnEditMode: true,
  autoCollapseCrossingClusters: true,
  showStreetGraph: true,
  showTrafficSignals: true,
  dataSaver: false,
  allowCellularDownloads: true,
  defaultBikeProfile: 'normal',
  defaultRoutingStrategy: 'balanced',
};
