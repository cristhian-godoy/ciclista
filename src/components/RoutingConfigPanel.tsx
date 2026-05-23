import React from 'react';
import type { BikeProfile } from '../core/storage/types';
import { Layers, RefreshCw } from 'lucide-react';

interface RoutingConfigPanelProps {
  selectedPreset: 'munich' | 'amsterdam';
  onPresetChange: (preset: 'munich' | 'amsterdam') => void;
  isFetchingOSM: boolean;
  bikeProfile: BikeProfile;
  onBikeProfileChange: (profile: BikeProfile) => void;
}

export const RoutingConfigPanel: React.FC<RoutingConfigPanelProps> = ({
  selectedPreset,
  onPresetChange,
  isFetchingOSM,
  bikeProfile,
  onBikeProfileChange,
}) => {
  return (
    <>
      {/* Dynamic Presets & Auto-Fetch Info */}
      <section className="route-card">
        <h2>
          <Layers
            size={16}
            style={{
              verticalAlign: 'middle',
              marginRight: '8px',
              color: 'var(--accent-secondary)',
            }}
          />
          Map Area Presets
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Choose a preset city. The map area will automatically expand and fetch OSM data as you
          drag or position the pins.
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              color: 'var(--accent-secondary)',
              marginTop: '8px',
            }}
          >
            <RefreshCw size={12} className="spin" />
            <span>Fetching street network from Overpass...</span>
          </div>
        )}
      </section>

      {/* Bike Profile */}
      <section className="form-group">
        <label className="form-label">Bike Profile</label>
        <div className="strategy-selector">
          {(['slow', 'normal', 'ebike'] as BikeProfile[]).map((p) => (
            <button
              key={p}
              className={`strategy-btn ${bikeProfile === p ? 'active' : ''}`}
              onClick={() => onBikeProfileChange(p)}
            >
              {p === 'slow' ? '🚲 Slow' : p === 'normal' ? '🚴 Normal' : '⚡ E-Bike'}
            </button>
          ))}
        </div>
      </section>
    </>
  );
};
