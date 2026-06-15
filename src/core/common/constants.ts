export const API_CONFIG = {
  OVERPASS_MIRRORS: [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    // Swiss mirror placed at the end due to aggressive throttling/silent empty elements responses.
    'https://overpass.osm.ch/api/interpreter',
  ],
  CACHE_NAME: 'overpass-cache-v1',
  QUERY_TIMEOUT_SECONDS: 25,
  CACHE_TTL_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  CACHE_MAX_ITEMS: 200,
} as const;

export const MAP_CONFIG = {
  PRESETS: {
    munich: {
      center: { lat: 48.13715, lng: 11.5754 },
      latMargin: 0.007,
      lngMargin: 0.01,
    },
    amsterdam: {
      center: { lat: 52.3725, lng: 4.89 },
      latMargin: 0.007,
      lngMargin: 0.01,
    },
  },
  DEFAULT_PRESET: 'munich' as const,
  // Limit bounding box size to prevent Overpass query timeouts (max ~35km span)
  MAX_LAT_SPAN: 0.32,
  MAX_LNG_SPAN: 0.42,
} as const;

export const ROUTING_CONFIG = {
  U_TURN_PENALTY_SECONDS: 30,
  NORMAL_TURN_PENALTY_SECONDS: 3,
  SNAPPING_DISTANCE_METERS: 3,
  INTERPOLATION_SPEED_MS: 1.5, // 1.5 m/s walk/push speed for out-of-network interpolation segments
} as const;
