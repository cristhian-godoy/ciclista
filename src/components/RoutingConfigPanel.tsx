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
          <Layers size={16} className="preset-header-icon" />
          Map Area Presets
        </h2>
        <p className="config-panel-desc">
          Choose a preset city. The map area will automatically expand and fetch OSM data as you
          drag or position the pins.
        </p>
        <div className="ciclista-form-group config-form-group">
          <label className="ciclista-label" htmlFor="city-preset-select">
            City Preset
          </label>
          <select
            id="city-preset-select"
            className="ciclista-input config-select"
            value={selectedPreset}
            onChange={(e) => onPresetChange(e.target.value as 'munich' | 'amsterdam')}
          >
            <option value="munich">Munich (Marienplatz)</option>
            <option value="amsterdam">Amsterdam (Center)</option>
          </select>
        </div>
        <div className="ciclista-form-group config-form-group">
          <label className="ciclista-label" htmlFor="map-theme-select">
            Map Theme
          </label>
          <select
            id="map-theme-select"
            className="ciclista-input config-select"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as 'bright' | 'liberty' | 'dark')}
          >
            <option value="bright">Bright</option>
            <option value="liberty">Liberty</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        {isFetchingOSM && (
          <div className="config-fetching-container">
            <RefreshCw size={12} className="spin" />
            <span>Fetching street network from Overpass...</span>
          </div>
        )}
      </section>

      {/* Bike Profile */}
      <section className="ciclista-form-group">
        <label className="ciclista-label">Bike Profile</label>
        <div className="strategy-selector">
          {(['slow', 'normal', 'ebike', 'road'] as BikeProfile[]).map((p) => (
            <button
              key={p}
              className={`strategy-btn ${bikeProfile === p ? 'active' : ''}`}
              onClick={() => onBikeProfileChange(p)}
            >
              {p === 'slow'
                ? '🚲 Slow'
                : p === 'normal'
                  ? '🚴 Normal'
                  : p === 'ebike'
                    ? '⚡ E-Bike'
                    : '🏁 Road'}
            </button>
          ))}
        </div>
      </section>
    </>
  );
};
