import { logger } from '../common/logger';

/**
 * Spatial network information interface for tracking network connection metrics.
 */
interface NetworkInformation {
  type?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  saveData?: boolean;
}

/**
 * Extended navigator interface exposing standard and proprietary network connection objects.
 */
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

/**
 * Data structure storing aggregated bandwidth usage metrics in bytes.
 */
export interface DataUsageStats {
  wifiBytes: number;
  cellularBytes: number;
  cacheBytes: number;
}

const KEYS = {
  WIFI_BYTES: 'ciclista_data_wifi',
  CELLULAR_BYTES: 'ciclista_data_cellular',
  CACHE_BYTES: 'ciclista_data_cache',
  DATA_SAVER: 'ciclista_data_saver',
  ALLOW_CELLULAR: 'ciclista_allow_cellular_download',
};

/**
 * Resolves the client's current connection type using the Network Information API.
 */
export function getConnectionType(): 'wifi' | 'cellular' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const conn =
    (navigator as NavigatorWithConnection).connection ||
    (navigator as NavigatorWithConnection).mozConnection ||
    (navigator as NavigatorWithConnection).webkitConnection;
  if (!conn) return 'unknown';

  if (conn.type) {
    if (conn.type === 'wifi' || conn.type === 'ethernet') return 'wifi';
    if (conn.type === 'cellular') return 'cellular';
  }

  return 'unknown';
}

/**
 * Determines whether bandwidth-saving restrictions should be active.
 */
export function isDataSaverActive(): boolean {
  if (typeof window === 'undefined') return false;

  const saved = localStorage.getItem(KEYS.DATA_SAVER);
  if (saved !== null) {
    return saved === 'true';
  }

  const conn =
    (navigator as NavigatorWithConnection).connection ||
    (navigator as NavigatorWithConnection).mozConnection ||
    (navigator as NavigatorWithConnection).webkitConnection;
  if (conn && conn.saveData === true) {
    return true;
  }

  return getConnectionType() === 'cellular';
}

/**
 * Sets the active state of the application-level data saver mode.
 */
export function setDataSaverActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.DATA_SAVER, active.toString());
}

/**
 * Evaluates whether network queries are permitted over cellular connections.
 */
export function isCellularDownloadAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEYS.ALLOW_CELLULAR) === 'true';
}

/**
 * Sets permission for data downloads over cellular connections.
 */
export function setCellularDownloadAllowed(allowed: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.ALLOW_CELLULAR, allowed.toString());
}

/**
 * Records additional network or cache bytes consumed by the application.
 */
export function addDataUsage(bytes: number, fromCache: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    if (fromCache) {
      const current = Number(localStorage.getItem(KEYS.CACHE_BYTES) || '0');
      localStorage.setItem(KEYS.CACHE_BYTES, (current + bytes).toString());
    } else {
      const type = getConnectionType();
      if (type === 'cellular') {
        const current = Number(localStorage.getItem(KEYS.CELLULAR_BYTES) || '0');
        localStorage.setItem(KEYS.CELLULAR_BYTES, (current + bytes).toString());
      } else {
        const current = Number(localStorage.getItem(KEYS.WIFI_BYTES) || '0');
        localStorage.setItem(KEYS.WIFI_BYTES, (current + bytes).toString());
      }
    }
    window.dispatchEvent(new Event('ciclista_data_usage_changed'));
  } catch (e) {
    logger.warn('Failed to update data usage stats in localStorage:', e);
  }
}

/**
 * Retrieves cached and network data usage statistics from local storage.
 */
export function getDataUsage(): DataUsageStats {
  if (typeof window === 'undefined') {
    return { wifiBytes: 0, cellularBytes: 0, cacheBytes: 0 };
  }
  return {
    wifiBytes: Number(localStorage.getItem(KEYS.WIFI_BYTES) || '0'),
    cellularBytes: Number(localStorage.getItem(KEYS.CELLULAR_BYTES) || '0'),
    cacheBytes: Number(localStorage.getItem(KEYS.CACHE_BYTES) || '0'),
  };
}

/**
 * Resets all recorded network and cache data transfer statistics.
 */
export function clearDataUsage(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.WIFI_BYTES, '0');
  localStorage.setItem(KEYS.CELLULAR_BYTES, '0');
  localStorage.setItem(KEYS.CACHE_BYTES, '0');
  window.dispatchEvent(new Event('ciclista_data_usage_changed'));
}
