import { Bike, Gauge, Layers, RefreshCw, Zap } from 'lucide-react';
import React from 'react';

import type { BikeConfig, BikeProfileId } from '../core/storage/types';

interface RoutingConfigPanelProps {
  selectedPreset: 'munich' | 'amsterdam';
  onPresetChange: (preset: 'munich' | 'amsterdam') => void;
  isFetchingOSM: boolean;
  bikeConfig: BikeConfig;
  onBikeConfigChange: (config: BikeConfig) => void;
  theme: 'bright' | 'liberty' | 'dark';
  onThemeChange: (theme: 'bright' | 'liberty' | 'dark') => void;
}

/**
 * Panel containing global configurations for routing preset selection,
 * active bike profiles, map theme overlays, and fetching statuses.
 */
export const RoutingConfigPanel: React.FC<RoutingConfigPanelProps> = ({
  selectedPreset,
  onPresetChange,
  isFetchingOSM,
  bikeConfig,
  onBikeConfigChange,
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
          {(['slow', 'normal', 'ebike', 'road', 'custom'] as BikeProfileId[]).map((p) => (
            <button
              key={p}
              className={`strategy-btn ${bikeConfig.id === p ? 'active' : ''}`}
              onClick={() => onBikeConfigChange({ id: p })}
            >
              {p === 'slow' && <Bike size={12} aria-label="Slow Bike Icon" />}
              {p === 'normal' && <Bike size={12} aria-label="Normal Bike Icon" />}
              {p === 'ebike' && <Zap size={12} aria-label="E-Bike Icon" />}
              {p === 'road' && <Gauge size={12} aria-label="Road Bike Icon" />}
              {p === 'custom' && <Gauge size={12} aria-label="Custom Bike Icon" />}
              <span>
                {p === 'slow'
                  ? 'Slow'
                  : p === 'normal'
                    ? 'Normal'
                    : p === 'ebike'
                      ? 'E-Bike'
                      : p === 'road'
                        ? 'Road'
                        : 'Custom'}
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
};
