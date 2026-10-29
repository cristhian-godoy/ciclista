import type { AppSettings } from './settings';

/**
 * Category partitions for grouping application settings.
 */
export type SettingCategory = 'appearance' | 'map' | 'network' | 'routing' | 'backup';

/**
 * Display labels for each setting category.
 */
export const CATEGORY_LABELS: Record<SettingCategory, string> = {
  appearance: 'Appearance & Theme',
  map: 'Map & Editor',
  network: 'Network & Cache',
  routing: 'Routing Defaults',
  backup: 'Backup & Reset',
};

/**
 * Metadata descriptor defining schema, UI controls, and search attributes for a setting.
 */
export interface SettingMetadata<K extends keyof AppSettings = keyof AppSettings> {
  key: K;
  title: string;
  label: string;
  category: SettingCategory;
  categoryLabel: string;
  type: 'boolean' | 'enum' | 'number';
  description: string;
  keywords?: string[];
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  defaultValue: AppSettings[K];
}

/**
 * Setting metadata item descriptor alias.
 */
export type SettingMetadataItem<K extends keyof AppSettings = keyof AppSettings> =
  SettingMetadata<K>;

/**
 * Mapping between setting property keys and their respective categories.
 */
export const SETTING_CATEGORY_MAP: Record<keyof AppSettings, SettingCategory> = {
  theme: 'appearance',
  freezePinsOnEditMode: 'map',
  autoCollapseCrossingClusters: 'map',
  showStreetGraph: 'map',
  showTrafficSignals: 'map',
  dataSaver: 'network',
  allowCellularDownloads: 'network',
  defaultBikeProfile: 'routing',
  defaultRoutingStrategy: 'routing',
};

/**
 * Static registry of metadata for all application configuration options.
 */
export const SETTINGS_METADATA: SettingMetadata<keyof AppSettings>[] = [
  {
    key: 'theme',
    title: 'Theme Color',
    label: 'Theme Color',
    category: 'appearance',
    categoryLabel: CATEGORY_LABELS.appearance,
    type: 'enum',
    description: 'Switch between Bright, Liberty, and Dark UI themes',
    options: [
      { value: 'bright', label: 'Bright Theme' },
      { value: 'liberty', label: 'Liberty Theme' },
      { value: 'dark', label: 'Dark Theme' },
    ],
    defaultValue: 'bright',
    keywords: ['theme', 'dark', 'bright', 'liberty', 'color', 'appearance', 'mode'],
  },
  {
    key: 'freezePinsOnEditMode',
    title: 'Freeze Pins on Edit Mode',
    label: 'Freeze Pins on Edit Mode',
    category: 'map',
    categoryLabel: CATEGORY_LABELS.map,
    type: 'boolean',
    description:
      'Freezes origin and destination routing pins to prevent accidental dragging or placement while editing crossing clusters or street edges',
    defaultValue: true,
    keywords: ['freeze', 'pins', 'edit', 'markers', 'drag', 'lock', 'routing'],
  },
  {
    key: 'autoCollapseCrossingClusters',
    title: 'Auto Collapse Crossing Clusters',
    label: 'Auto Collapse Crossing Clusters',
    category: 'map',
    categoryLabel: CATEGORY_LABELS.map,
    type: 'boolean',
    description:
      'Automatically collapses expanded crossing clusters when zooming out or panning far',
    defaultValue: true,
    keywords: ['crossing', 'cluster', 'collapse', 'zoom', 'pan', 'editor'],
  },
  {
    key: 'showStreetGraph',
    title: 'Show Street Graph Overlay',
    label: 'Show Street Graph Overlay',
    category: 'map',
    categoryLabel: CATEGORY_LABELS.map,
    type: 'boolean',
    description: 'Toggles the vector street network graph overlay on the map',
    defaultValue: true,
    keywords: ['street', 'graph', 'layer', 'overlay', 'vector', 'network'],
  },
  {
    key: 'showTrafficSignals',
    title: 'Show Traffic Signals',
    label: 'Show Traffic Signals',
    category: 'map',
    categoryLabel: CATEGORY_LABELS.map,
    type: 'boolean',
    description: 'Toggles individual traffic signals and crossing cluster marker icons on the map',
    defaultValue: true,
    keywords: ['traffic', 'signals', 'crossings', 'lights', 'icons', 'markers'],
  },
  {
    key: 'dataSaver',
    title: 'Data Saver',
    label: 'Data Saver',
    category: 'network',
    categoryLabel: CATEGORY_LABELS.network,
    type: 'boolean',
    description:
      'Restricts automatic background Overpass queries and map tile prefetching to conserve bandwidth',
    defaultValue: false,
    keywords: ['data', 'saver', 'bandwidth', 'overpass', 'cache', 'network', 'tiles'],
  },
  {
    key: 'allowCellularDownloads',
    title: 'Allow Cellular Downloads',
    label: 'Allow Cellular Downloads',
    category: 'network',
    categoryLabel: CATEGORY_LABELS.network,
    type: 'boolean',
    description:
      'Controls whether heavy OSM data tiles can be fetched over metered cellular connections',
    defaultValue: true,
    keywords: ['cellular', 'mobile', 'metered', 'downloads', 'network', 'osm'],
  },
  {
    key: 'defaultBikeProfile',
    title: 'Default Bike Profile',
    label: 'Default Bike Profile',
    category: 'routing',
    categoryLabel: CATEGORY_LABELS.routing,
    type: 'enum',
    description: 'Default bicycle profile applied upon app load',
    options: [
      { value: 'normal', label: 'City Bike (Normal)' },
      { value: 'slow', label: 'Leisure / Slow' },
      { value: 'ebike', label: 'E-Bike' },
      { value: 'road', label: 'Road Bike' },
      { value: 'custom', label: 'Custom' },
    ],
    defaultValue: 'normal',
    keywords: ['bike', 'profile', 'bicycle', 'speed', 'routing', 'ebike', 'road'],
  },
  {
    key: 'defaultRoutingStrategy',
    title: 'Default Routing Strategy',
    label: 'Default Routing Strategy',
    category: 'routing',
    categoryLabel: CATEGORY_LABELS.routing,
    type: 'enum',
    description: 'Default route optimization variant applied upon app load',
    options: [
      { value: 'balanced', label: 'Balanced' },
      { value: 'fastest', label: 'Fastest' },
      { value: 'safe', label: 'Safe' },
      { value: 'scenic', label: 'Scenic' },
    ],
    defaultValue: 'balanced',
    keywords: ['routing', 'strategy', 'optimization', 'balanced', 'fastest', 'safe', 'scenic'],
  },
];

/**
 * Retrieves metadata for a specific setting key.
 *
 * @param key - Setting property key.
 * @returns Metadata descriptor if found, otherwise undefined.
 */
export function getSettingMetadata<K extends keyof AppSettings>(
  key: K,
): SettingMetadata<K> | undefined {
  return SETTINGS_METADATA.find((s) => s.key === key) as SettingMetadata<K> | undefined;
}

/**
 * Searches settings metadata by query matching key, title/label, category, description, and keywords.
 *
 * @param query - Search string query.
 * @returns Array of matching settings metadata descriptors.
 */
export function searchSettings(query: string): SettingMetadata<keyof AppSettings>[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [...SETTINGS_METADATA];
  }

  return SETTINGS_METADATA.filter((item) => {
    if (item.key.toLowerCase().includes(trimmed)) return true;
    if (item.title.toLowerCase().includes(trimmed)) return true;
    if (item.label.toLowerCase().includes(trimmed)) return true;
    if (item.category.toLowerCase().includes(trimmed)) return true;
    if (item.categoryLabel.toLowerCase().includes(trimmed)) return true;
    if (item.description.toLowerCase().includes(trimmed)) return true;
    if (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(trimmed))) return true;
    return false;
  });
}
