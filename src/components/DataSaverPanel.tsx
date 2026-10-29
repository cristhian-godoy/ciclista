import React, { useEffect, useState } from 'react';

import { API_CONFIG } from '../core/common/constants';
import {
  clearDataUsage,
  getConnectionType,
  getDataUsage,
  setCellularDownloadAllowed,
  setDataSaverActive,
} from '../core/storage/dataUsage';
import { settingsStore, useSettings } from '../store/settingsStore';
import { Database, HardDrive, Wifi, WifiOff } from './common/Icon';
import { Select } from './common/Select';

/**
 * Panel displaying network data transfer statistics, cache usage, offline state,
 * and configurable data saving policies using design-system controls.
 */
export const DataSaverPanel: React.FC = () => {
  const settings = useSettings();
  const [stats, setStats] = useState(getDataUsage());
  const [connType, setConnType] = useState(getConnectionType());
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [clearingCache, setClearingCache] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clear' | 'reset' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleStatsChange = () => {
      setStats(getDataUsage());
      setConnType(getConnectionType());
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Update connection type periodically
    const interval = setInterval(() => {
      setConnType(getConnectionType());
    }, 5000);

    window.addEventListener('ciclista_data_usage_changed', handleStatsChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('ciclista_data_usage_changed', handleStatsChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0.00 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const totalProcessedBytes = stats.wifiBytes + stats.cellularBytes + stats.cacheBytes;
  const cacheHitRatioPercent =
    totalProcessedBytes > 0 ? Math.round((stats.cacheBytes / totalProcessedBytes) * 100) : 0;

  const currentPolicyMode = !settings.dataSaver ? 'off' : 'always';

  const handlePolicyChange = (mode: string) => {
    const active = mode === 'always';
    setDataSaverActive(active);
    settingsStore.updateSettings({ dataSaver: active });
  };

  const handleCellularPolicyChange = (val: string) => {
    const allowed = val === 'allowed';
    setCellularDownloadAllowed(allowed);
    settingsStore.updateSettings({ allowCellularDownloads: allowed });
  };

  const executeClearCache = async () => {
    if (typeof window === 'undefined') return;
    setClearingCache(true);
    setConfirmAction(null);

    try {
      if ('caches' in window) {
        await caches.delete(API_CONFIG.CACHE_NAME);
      }
      setStatusMessage('Map cache cleared successfully.');
    } catch (e) {
      console.error('Failed to clear CacheStorage:', e);
      setStatusMessage('Failed to clear cache.');
    } finally {
      setClearingCache(false);
    }
  };

  const executeResetStats = () => {
    clearDataUsage();
    setConfirmAction(null);
    setStatusMessage('Data usage statistics reset to zero.');
  };

  return (
    <section className="ciclista-card data-saver-panel">
      <h2>
        <Database size={16} className="data-saver-header-icon" />
        Data & Cache Saver
      </h2>
      <p className="config-panel-desc">
        Monitor data transfers, inspect disk cache savings, and restrict network queries.
      </p>

      {/* Network & Offline Indicators */}
      <div className="data-saver-status">
        {!isOnline ? (
          <>
            <WifiOff size={14} className="data-saver-icon-warn" />
            <span>
              Network: <strong>Offline Mode</strong> (Serving cached map data)
            </span>
          </>
        ) : connType === 'wifi' ? (
          <>
            <Wifi size={14} className="data-saver-icon-accent" />
            <span>
              Connection: <strong>WiFi / Ethernet</strong> (Online)
            </span>
          </>
        ) : connType === 'cellular' ? (
          <>
            <WifiOff size={14} className="data-saver-icon-warn" />
            <span>
              Connection: <strong>Mobile Data</strong> (Cellular)
            </span>
          </>
        ) : (
          <>
            <Wifi size={14} className="data-saver-icon-muted" />
            <span>
              Connection: <strong>Active Network</strong> (Online)
            </span>
          </>
        )}
      </div>

      {/* Cache Statistics Grid */}
      <div className="data-saver-grid">
        <div className="data-saver-card">
          <div className="data-saver-lbl">Network Transferred</div>
          <div className="data-saver-val">{formatBytes(stats.wifiBytes + stats.cellularBytes)}</div>
          <div className="data-saver-sub">
            WiFi: {formatBytes(stats.wifiBytes)} | Mob: {formatBytes(stats.cellularBytes)}
          </div>
        </div>

        <div className="data-saver-card data-saver-card--saved">
          <div className="data-saver-lbl">Cache Saved (Hits)</div>
          <div className="data-saver-val data-saver-val--saved">
            {formatBytes(stats.cacheBytes)}
          </div>
          <div className="data-saver-sub">Hit Ratio: {cacheHitRatioPercent}%</div>
        </div>
      </div>

      {/* Form Controls with Select Primitives */}
      <div className="data-saver-controls">
        <Select
          label="Data Saver Mode"
          value={currentPolicyMode}
          onChange={handlePolicyChange}
          options={[
            { value: 'always', label: 'Always Active (Restrict transfers)' },
            { value: 'off', label: 'Disabled (Unlimited network access)' },
          ]}
          aria-label="Data Saver Mode"
        />

        <Select
          label="Cellular Data Policy"
          value={settings.allowCellularDownloads ? 'allowed' : 'blocked'}
          onChange={handleCellularPolicyChange}
          options={[
            { value: 'allowed', label: 'Allowed (Download on cellular)' },
            { value: 'blocked', label: 'Blocked (WiFi / Ethernet only)' },
          ]}
          aria-label="Cellular Data Policy"
        />
      </div>

      {/* Non-blocking inline confirmation box */}
      {confirmAction && (
        <div className="data-saver-status ciclista-confirm-box" role="alert">
          <span>
            {confirmAction === 'clear'
              ? 'Clear all cached street segments and map data?'
              : 'Reset all network transfer counters to zero?'}
          </span>
          <div className="ciclista-confirm-actions">
            <button
              type="button"
              className="ciclista-btn ciclista-btn--danger ciclista-btn--sm"
              onClick={confirmAction === 'clear' ? executeClearCache : executeResetStats}
            >
              Confirm
            </button>
            <button
              type="button"
              className="ciclista-btn ciclista-btn--secondary ciclista-btn--sm"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status banner */}
      {statusMessage && (
        <div className="data-saver-sub" role="status">
          {statusMessage}
        </div>
      )}

      {/* Actions */}
      <div className="data-saver-actions">
        <button
          type="button"
          onClick={() => setConfirmAction('clear')}
          className="ciclista-btn ciclista-btn--secondary data-saver-btn"
          disabled={clearingCache || confirmAction !== null}
        >
          <HardDrive size={12} />
          {clearingCache ? 'Clearing...' : 'Clear Cache'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmAction('reset')}
          className="ciclista-btn ciclista-btn--secondary data-saver-btn"
          disabled={confirmAction !== null}
        >
          Reset Stats
        </button>
      </div>
    </section>
  );
};
