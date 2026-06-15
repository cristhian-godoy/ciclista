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
    <section className="ciclista-card" style={{ marginTop: '16px' }}>
      <h2>
        <Database size={16} className="preset-header-icon" />
        Data & Cache Saver
      </h2>
      <p className="config-panel-desc">
        Monitor data transfers and restrict network queries over cellular connections.
      </p>

      {/* Network Info Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          marginBottom: '12px',
          fontSize: '13px',
        }}
      >
        {connType === 'wifi' ? (
          <>
            <Wifi size={14} style={{ color: 'var(--accent-primary)' }} />
            <span>
              Connection: <strong>WiFi / Ethernet</strong> (Unlimited)
            </span>
          </>
        ) : connType === 'cellular' ? (
          <>
            <WifiOff size={14} style={{ color: '#ff9800' }} />
            <span>
              Connection: <strong>Mobile Data</strong> (Restricted)
            </span>
          </>
        ) : (
          <>
            <Wifi size={14} style={{ opacity: 0.5 }} />
            <span>
              Connection: <strong>Unknown Network</strong>
            </span>
          </>
        )}
      </div>

      {/* Stats Table */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            padding: '8px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--ciclista-color-text-muted)' }}>
            Network Data
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '2px' }}>
            {formatBytes(stats.wifiBytes + stats.cellularBytes)}
          </div>
          <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '2px' }}>
            WiFi: {formatBytes(stats.wifiBytes)} | Mob: {formatBytes(stats.cellularBytes)}
          </div>
        </div>

        <div
          style={{
            padding: '8px',
            borderRadius: '6px',
            backgroundColor: 'rgba(0, 255, 128, 0.03)',
            border: '1px solid rgba(0, 255, 128, 0.1)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--ciclista-color-text-muted)' }}>
            Cache Saved
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '2px', color: '#00e676' }}>
            {formatBytes(stats.cacheBytes)}
          </div>
          <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '2px' }}>Local disk hits</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label htmlFor="data-saver-toggle" style={{ fontSize: '13px', cursor: 'pointer' }}>
            Data Saver Mode
          </label>
          <input
            id="data-saver-toggle"
            type="checkbox"
            checked={dataSaver}
            onChange={handleToggleDataSaver}
            style={{ cursor: 'pointer' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label htmlFor="allow-cellular-toggle" style={{ fontSize: '13px', cursor: 'pointer' }}>
            Allow Cellular Downloads
          </label>
          <input
            id="allow-cellular-toggle"
            type="checkbox"
            checked={allowCellular}
            onChange={handleToggleAllowCellular}
            style={{ cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={handleClearCache}
          className="ciclista-btn ciclista-btn--secondary"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '12px',
            padding: '6px 8px',
          }}
          disabled={clearingCache}
        >
          <HardDrive size={12} />
          {clearingCache ? 'Clearing...' : 'Clear Cache'}
        </button>
        <button
          onClick={handleResetStats}
          className="ciclista-btn ciclista-btn--secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            padding: '6px 8px',
          }}
        >
          Reset Stats
        </button>
      </div>
    </section>
  );
};
