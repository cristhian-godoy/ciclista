import { Database, HardDrive, Wifi, WifiOff } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { API_CONFIG } from '../core/common/constants';
import {
  clearDataUsage,
  getConnectionType,
  getDataUsage,
  isCellularDownloadAllowed,
  isDataSaverActive,
  setCellularDownloadAllowed,
  setDataSaverActive,
} from '../core/storage/dataUsage';

/**
 *
 */
export const DataSaverPanel: React.FC = () => {
  const [stats, setStats] = useState(getDataUsage());
  const [connType, setConnType] = useState(getConnectionType());
  const [dataSaver, setDataSaver] = useState(isDataSaverActive());
  const [allowCellular, setAllowCellular] = useState(isCellularDownloadAllowed());
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    const handleStatsChange = () => {
      setStats(getDataUsage());
      setConnType(getConnectionType());
    };

    // Update connection type periodically
    const interval = setInterval(() => {
      setConnType(getConnectionType());
    }, 5000);

    window.addEventListener('ciclista_data_usage_changed', handleStatsChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ciclista_data_usage_changed', handleStatsChange);
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0.00 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const handleToggleDataSaver = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setDataSaver(val);
    setDataSaverActive(val);
  };

  const handleToggleAllowCellular = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAllowCellular(val);
    setCellularDownloadAllowed(val);
  };

  const handleClearCache = async () => {
    if (typeof window === 'undefined') return;
    const confirmed = window.confirm(
      'Are you sure you want to clear the client-side map cache? This will delete all downloaded street segments.',
    );
    if (!confirmed) return;

    setClearingCache(true);
    try {
      if ('caches' in window) {
        await caches.delete(API_CONFIG.CACHE_NAME);
      }
      alert('Map cache cleared successfully. Reloading map...');
      window.location.reload();
    } catch (e) {
      console.error('Failed to clear CacheStorage:', e);
      alert('Failed to clear cache.');
    } finally {
      setClearingCache(false);
    }
  };

  const handleResetStats = () => {
    if (window.confirm('Reset data usage statistics?')) {
      clearDataUsage();
    }
  };

  return (
    <section className="ciclista-card data-saver-panel">
      <h2>
        <Database size={16} className="preset-header-icon" />
        Data & Cache Saver
      </h2>
      <p className="config-panel-desc">
        Monitor data transfers and restrict network queries over cellular connections.
      </p>

      {/* Network Info Status */}
      <div className="data-saver-status">
        {connType === 'wifi' ? (
          <>
            <Wifi size={14} className="data-saver-icon-accent" />
            <span>
              Connection: <strong>WiFi / Ethernet</strong> (Unlimited)
            </span>
          </>
        ) : connType === 'cellular' ? (
          <>
            <WifiOff size={14} className="data-saver-icon-warn" />
            <span>
              Connection: <strong>Mobile Data</strong> (Restricted)
            </span>
          </>
        ) : (
          <>
            <Wifi size={14} className="data-saver-icon-muted" />
            <span>
              Connection: <strong>Unknown Network</strong>
            </span>
          </>
        )}
      </div>

      {/* Stats Table */}
      <div className="data-saver-grid">
        <div className="data-saver-card">
          <div className="data-saver-lbl">Network Data</div>
          <div className="data-saver-val">{formatBytes(stats.wifiBytes + stats.cellularBytes)}</div>
          <div className="data-saver-sub">
            WiFi: {formatBytes(stats.wifiBytes)} | Mob: {formatBytes(stats.cellularBytes)}
          </div>
        </div>

        <div className="data-saver-card data-saver-card--saved">
          <div className="data-saver-lbl">Cache Saved</div>
          <div className="data-saver-val data-saver-val--saved">
            {formatBytes(stats.cacheBytes)}
          </div>
          <div className="data-saver-sub">Local disk hits</div>
        </div>
      </div>

      {/* Controls */}
      <div className="data-saver-controls">
        <div className="data-saver-row">
          <label htmlFor="data-saver-toggle">Data Saver Mode</label>
          <input
            id="data-saver-toggle"
            type="checkbox"
            checked={dataSaver}
            onChange={handleToggleDataSaver}
            className="ciclista-checkbox"
          />
        </div>
        <div className="data-saver-row">
          <label htmlFor="allow-cellular-toggle">Allow Cellular Downloads</label>
          <input
            id="allow-cellular-toggle"
            type="checkbox"
            checked={allowCellular}
            onChange={handleToggleAllowCellular}
            className="ciclista-checkbox"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="data-saver-actions">
        <button
          onClick={handleClearCache}
          className="ciclista-btn ciclista-btn--secondary data-saver-btn"
          disabled={clearingCache}
        >
          <HardDrive size={12} />
          {clearingCache ? 'Clearing...' : 'Clear Cache'}
        </button>
        <button
          onClick={handleResetStats}
          className="ciclista-btn ciclista-btn--secondary data-saver-btn"
        >
          Reset Stats
        </button>
      </div>
    </section>
  );
};
