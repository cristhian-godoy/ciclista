import React, { useState } from 'react';
import type { Coordinate, RouteResult } from '../core/types';
import { Navigation, RefreshCw, Layers } from 'lucide-react';

interface SidebarProps {
  startCoord: Coordinate;
  endCoord: Coordinate;
  routeResult: RouteResult | null;
  routingStrategy: 'standard' | 'avoid-stops' | 'quiet-streets';
  isFetchingOSM: boolean;
  onStrategyChange: (strategy: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  onFetchOSM: (bbox: [number, number, number, number]) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  routeResult,
  routingStrategy,
  isFetchingOSM,
  onStrategyChange,
  onFetchOSM,
}) => {
  // Bounding box inputs (defaulting around Munich center)
  const [bboxInput, setBboxInput] = useState({
    minLat: '48.125',
    minLng: '11.555',
    maxLat: '48.148',
    maxLng: '11.595',
  });

  const [selectedPreset, setSelectedPreset] = useState('munich');
  const [showBBoxCoords, setShowBBoxCoords] = useState(false);

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedPreset(val);
    if (val === 'munich') {
      setBboxInput({
        minLat: '48.125',
        minLng: '11.555',
        maxLat: '48.148',
        maxLng: '11.595',
      });
    } else if (val === 'amsterdam') {
      setBboxInput({
        minLat: '52.365',
        minLng: '4.885',
        maxLat: '52.378',
        maxLng: '4.908',
      });
    }
  };

  const handleFetch = () => {
    const minLat = parseFloat(bboxInput.minLat);
    const minLng = parseFloat(bboxInput.minLng);
    const maxLat = parseFloat(bboxInput.maxLat);
    const maxLng = parseFloat(bboxInput.maxLng);

    if (!isNaN(minLat) && !isNaN(minLng) && !isNaN(maxLat) && !isNaN(maxLng)) {
      onFetchOSM([minLat, minLng, maxLat, maxLng]);
    } else {
      alert('Please enter valid numerical coordinates.');
    }
  };

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
        {/* Section 1: Fetch OSM Bounding Box */}
        <section className="route-card">
          <h2>
            <Layers size={16} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--accent-secondary)' }} />
            Map Area (Overpass API)
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Choose a city preset to load live street data from the Overpass API:
          </p>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">City Preset</label>
            <select
              className="input-text"
              value={selectedPreset}
              onChange={handlePresetChange}
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="form-label" style={{ marginBottom: 0 }}>Custom Bounds</span>
            <button
              type="button"
              onClick={() => setShowBBoxCoords(!showBBoxCoords)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
                fontWeight: 600,
              }}
            >
              {showBBoxCoords ? 'Hide Coordinates' : 'Show Coordinates'}
            </button>
          </div>

          {showBBoxCoords && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Min Lat</label>
                <input
                  className="input-text"
                  type="text"
                  value={bboxInput.minLat}
                  onChange={e => setBboxInput({ ...bboxInput, minLat: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Min Lng</label>
                <input
                  className="input-text"
                  type="text"
                  value={bboxInput.minLng}
                  onChange={e => setBboxInput({ ...bboxInput, minLng: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Lat</label>
                <input
                  className="input-text"
                  type="text"
                  value={bboxInput.maxLat}
                  onChange={e => setBboxInput({ ...bboxInput, maxLat: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Lng</label>
                <input
                  className="input-text"
                  type="text"
                  value={bboxInput.maxLng}
                  onChange={e => setBboxInput({ ...bboxInput, maxLng: e.target.value })}
                />
              </div>
            </div>
          )}
          <button className="btn btn-primary" onClick={handleFetch} disabled={isFetchingOSM}>
            <RefreshCw size={14} className={isFetchingOSM ? 'spin' : ''} style={{ marginRight: '6px' }} />
            {isFetchingOSM ? 'Fetching OSM data...' : 'Query & Load Map Area'}
          </button>
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
