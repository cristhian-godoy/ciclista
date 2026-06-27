import { Bike, Layers, RefreshCw, Zap } from 'lucide-react';
import React from 'react';

import type { BikeConfig, BikeProfileId } from '../core/config';

interface RoutingConfigPanelProps {
  selectedPreset: 'munich' | 'amsterdam';
  onPresetChange: (preset: 'munich' | 'amsterdam') => void;
  isFetchingOSM: boolean;
  bikeConfig: BikeConfig;
  onBikeConfigChange: (config: BikeConfig) => void;
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
          {[
            { id: 'normal', label: 'Standard', icon: Bike },
            { id: 'ebike', label: 'E-Bike', icon: Zap },
            { id: 'slow', label: 'Cargo', icon: Bike },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`strategy-btn ${bikeConfig.id === id ? 'active' : ''}`}
              onClick={() => onBikeConfigChange({ id: id as BikeProfileId })}
            >
              <Icon size={12} aria-label={`${label} Icon`} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
};
