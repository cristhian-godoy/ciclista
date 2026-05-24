import { Layers, RefreshCw } from 'lucide-react';
import React from 'react';

import type { BikeProfile } from '../core/storage/types';

interface RoutingConfigPanelProps {
  selectedPreset: 'munich' | 'amsterdam';
  onPresetChange: (preset: 'munich' | 'amsterdam') => void;
  isFetchingOSM: boolean;
  bikeProfile: BikeProfile;
  onBikeProfileChange: (profile: BikeProfile) => void;
  theme: 'bright' | 'liberty' | 'dark';
  onThemeChange: (theme: 'bright' | 'liberty' | 'dark') => void;
}

/**
 *
 */
export const RoutingConfigPanel: React.FC<RoutingConfigPanelProps> = ({
  selectedPreset,
  onPresetChange,
  isFetchingOSM,
  bikeProfile,
  onBikeProfileChange,
  theme,
  onThemeChange,
}) => {
  return (
    <>
      {/* Dynamic Presets & Auto-Fetch Info */}
      <section className="ciclista-card">
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
        <div className="ciclista-form-group" style={{ marginBottom: '12px' }}>
          <label className="ciclista-label" htmlFor="city-preset-select">
            City Preset
          </label>
          <select
            id="city-preset-select"
            className="ciclista-input"
            value={selectedPreset}
            onChange={(e) => onPresetChange(e.target.value as 'munich' | 'amsterdam')}
            style={{ cursor: 'pointer' }}
          >
            <option value="munich">Munich (Marienplatz)</option>
            <option value="amsterdam">Amsterdam (Center)</option>
          </select>
        </div>
        <div className="ciclista-form-group" style={{ marginBottom: '12px' }}>
          <label className="ciclista-label" htmlFor="map-theme-select">
            Map Theme
          </label>
          <select
            id="map-theme-select"
            className="ciclista-input"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as 'bright' | 'liberty' | 'dark')}
            style={{ cursor: 'pointer' }}
          >
            <option value="bright">Bright</option>
            <option value="liberty">Liberty</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        {isFetchingOSM && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              color: 'var(--ciclista-color-brand-secondary)',
              marginTop: '8px',
            }}
          >
            <RefreshCw size={12} className="spin" />
            <span>Fetching street network from Overpass...</span>
          </div>
        )}
      </section>

      {/* Bike Profile */}
      <section className="ciclista-form-group">
        <label className="ciclista-label">Bike Profile</label>
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
