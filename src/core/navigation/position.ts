import type { Coordinate } from '../common/types';

/**
 * Unified interface for coordinate emission streams across real and simulated sources.
 */
export interface PositionProvider {
  start(): void;
  stop(): void;
  onPosition(cb: (coord: Coordinate, timestamp: number, speed?: number) => void): void;
  onError(cb: (err: GeolocationPositionError | Error) => void): void;
}

/**
 * Project a latitude/longitude coordinate by a specified distance along a compass bearing.
 */
function moveCoordinate(lat: number, lng: number, bearing: number, distanceM: number): Coordinate {
  const R = 6371000;
  const dR = distanceM / R;
  const bearingRad = (bearing * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const nextLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(dR) + Math.cos(latRad) * Math.sin(dR) * Math.cos(bearingRad),
  );
  const nextLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(dR) * Math.cos(latRad),
      Math.cos(dR) - Math.sin(latRad) * Math.sin(nextLatRad),
    );

  return {
    lat: (nextLatRad * 180) / Math.PI,
    lng: (nextLngRad * 180) / Math.PI,
  };
}

/**
 * Creates a position provider wrapping the HTML5 Geolocation watchPosition API.
 */
export function createGeoProvider(
  options: PositionOptions = { enableHighAccuracy: true },
): PositionProvider {
  let watchId: number | null = null;
  let posCb: ((coord: Coordinate, timestamp: number, speed?: number) => void) | null = null;
  let errCb: ((err: GeolocationPositionError) => void) | null = null;

  return {
    start() {
      const proceed = () => {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            // Discard readings with low precision (> 50m error margin)
            if (position.coords.accuracy > 50) {
              return;
            }
            if (posCb) {
              posCb(
                {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                },
                position.timestamp,
                position.coords.speed ?? undefined,
              );
            }
          },
          (error) => {
            if (errCb) {
              errCb(error);
            }
          },
          options,
        );
      };

      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: 'geolocation' as PermissionName })
          .then((permissionStatus) => {
            if (permissionStatus.state === 'denied') {
              if (errCb) {
                errCb({
                  code: 1, // PERMISSION_DENIED
                  message: 'Geolocation permission denied',
                  PERMISSION_DENIED: 1,
                  POSITION_UNAVAILABLE: 2,
                  TIMEOUT: 3,
                } as GeolocationPositionError);
              }
            } else {
              proceed();
            }
          })
          .catch(() => {
            proceed();
          });
      } else {
        proceed();
      }
    },
    stop() {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    },
    onPosition(cb) {
      posCb = cb;
    },
    onError(cb) {
      errCb = cb;
    },
  };
}

/**
 * Creates a keyboard-driven position simulator using requestAnimationFrame.
 */
export function createWASDProvider(
  initialCoord: Coordinate,
  speedMPerSecond = 8,
): PositionProvider {
  let lat = initialCoord.lat;
  let lng = initialCoord.lng;
  let bearing = 0;

  let running = false;
  let rafId: number | null = null;
  let posCb: ((coord: Coordinate, timestamp: number, speed?: number) => void) | null = null;

  const activeKeys = new Set<string>();

  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(key)) {
      activeKeys.add(key);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    activeKeys.delete(key);
  };

  let lastTime = 0;

  const tick = (now: number) => {
    if (!running) return;
    if (lastTime === 0) lastTime = now;
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (activeKeys.size > 0) {
      if (activeKeys.has('a')) {
        bearing = (bearing - 5 + 360) % 360;
      }
      if (activeKeys.has('d')) {
        bearing = (bearing + 5) % 360;
      }

      let distance = 0;
      let speed = 0;
      if (activeKeys.has('w')) {
        distance = speedMPerSecond * dt;
        speed = speedMPerSecond * 3.6;
      } else if (activeKeys.has('s')) {
        distance = -speedMPerSecond * dt;
        speed = speedMPerSecond * 3.6;
      }

      if (distance !== 0 || activeKeys.has('a') || activeKeys.has('d')) {
        if (distance !== 0) {
          const next = moveCoordinate(lat, lng, bearing, distance);
          lat = next.lat;
          lng = next.lng;
        }
        if (posCb) {
          posCb({ lat, lng }, Date.now(), speed);
        }
      }
    }
    rafId = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      if (!running) return;
      running = false;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      activeKeys.clear();
    },
    onPosition(cb) {
      posCb = cb;
    },
    onError() {},
  };
}

/**
 * Factory constructing a position stream depending on execution mode.
 */
export function createPositionProvider(
  mode: 'gps' | 'dev',
  initialCoord: Coordinate = { lat: 0, lng: 0 },
): PositionProvider {
  if (mode === 'dev') {
    return createWASDProvider(initialCoord);
  }
  return createGeoProvider();
}
