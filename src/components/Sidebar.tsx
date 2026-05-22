import React from 'react';
import type { Coordinate, RouteResult } from '../core/types';
import { Navigation, RefreshCw, Layers } from 'lucide-react';

interface SidebarProps {
  startCoord: Coordinate;
  endCoord: Coordinate;
  routeResult: RouteResult | null;
  routingStrategy: 'standard' | 'avoid-stops' | 'quiet-streets';
  isFetchingOSM: boolean;
  onStrategyChange: (strategy: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  onPresetChange: (presetName: 'munich' | 'amsterdam') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  routeResult,
  routingStrategy,
  isFetchingOSM,
  onStrategyChange,
  selectedPreset,
  onPresetChange,
}) => {
  // Formatting helpers
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Navigation size={24} className="color-primary" style={{ color: 'var(--accent-primary)' }} />
        <h1>Ciclista</h1>
      </div>

      <div className="sidebar-content">
        {/* Section 1: Dynamic Presets & Auto-Fetch Info */}
        <section className="route-card">
          <h2>
            <Layers size={16} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--accent-secondary)' }} />
            Map Area Presets
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Choose a preset city. The map area will automatically expand and fetch OSM data as you drag or position the pins.
          </p>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">City Preset</label>
            <select
              className="input-text"
              value={selectedPreset}
              onChange={(e) => onPresetChange(e.target.value as 'munich' | 'amsterdam')}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="munich">Munich (Marienplatz)</option>
              <option value="amsterdam">Amsterdam (Center)</option>
            </select>
          </div>
          {isFetchingOSM && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--accent-secondary)', marginTop: '8px' }}>
              <RefreshCw size={12} className="spin" />
              <span>Fetching street network from Overpass...</span>
            </div>
          )}
        </section>

        {/* Section 2: Strategy Selector */}
        <section className="form-group">
          <label className="form-label">Routing Cost Strategy</label>
          <div className="strategy-selector">
            <button
              className={`strategy-btn ${routingStrategy === 'standard' ? 'active' : ''}`}
              onClick={() => onStrategyChange('standard')}
            >
              Speed
            </button>
            <button
              className={`strategy-btn ${routingStrategy === 'avoid-stops' ? 'active' : ''}`}
              onClick={() => onStrategyChange('avoid-stops')}
            >
              Avoid Stops
            </button>
            <button
              className={`strategy-btn ${routingStrategy === 'quiet-streets' ? 'active' : ''}`}
              onClick={() => onStrategyChange('quiet-streets')}
            >
              Quiet Paths
            </button>
          </div>
        </section>

        {/* Section 3: Travel Analytics */}
        <section className="route-card">
          <h2>Route Analytics</h2>
          {routeResult ? (
            <div>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-val">{formatTime(routeResult.totalDurationSeconds)}</span>
                  <span className="stat-lbl">Time Cost</span>
                </div>
                <div className="stat-item">
                  <span className="stat-val">{formatDistance(routeResult.totalDistanceMeters)}</span>
                  <span className="stat-lbl">Distance</span>
                </div>
                <div className="stat-item">
                  <span className="stat-val">{routeResult.trafficSignalsCount}</span>
                  <span className="stat-lbl">Signals</span>
                </div>
              </div>

              {routeResult.streets.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <span className="form-label" style={{ display: 'block', marginBottom: '4px' }}>Streets Traversed</span>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {routeResult.streets.join(' → ')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              No route found. Drag map pins to trigger routing calculations.
            </p>
          )}
        </section>


      </div>

      <div className="sidebar-footer">
        <p>Drag green/red pins or right-click map to route.</p>
        <p style={{ marginTop: '4px' }}>Click red nodes to time stoplights.</p>
      </div>
    </aside>
  );
};
