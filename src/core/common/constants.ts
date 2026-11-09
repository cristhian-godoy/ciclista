export const API_CONFIG = {
  // IMPORTANT: Any mirror origin added here must also be added to the
  // Content-Security-Policy `connect-src` directive in `index.html`.
  OVERPASS_MIRRORS: [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://ovp.dresel.systems/api/interpreter',
  ],
  CACHE_NAME: 'overpass-cache-v1',
  QUERY_TIMEOUT_SECONDS: 25,
  MIRROR_REQUEST_TIMEOUT_MS: 25000,
  CACHE_TTL_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  CACHE_MAX_ITEMS: 200,
} as const;

export const MAP_CONFIG = {
  DEFAULT_CENTER: { lat: 48.13715, lng: 11.5754 },
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

export const CHUNK_CONFIG = {
  SIZE_LAT: 0.01,
  SIZE_LNG: 0.01,
  MAX_CHUNKS_LIMIT: 150,
} as const;
