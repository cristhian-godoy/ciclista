import { ArrowUpDown, Bike, MapPin, RefreshCw, Zap } from 'lucide-react';
import React, { useState } from 'react';

import type { Coordinate } from '../core/common/types';
import type { BikeConfig, BikeProfileId } from '../core/config';

/**
 * Properties for the RoutingConfigPanel component.
 */
export interface RoutingConfigPanelProps {
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  onSwapCoords?: () => void;
  onSetStartCoord?: (coord: Coordinate) => void;
  onSetEndCoord?: (coord: Coordinate) => void;
  isFetchingOSM: boolean;
  bikeConfig: BikeConfig;
  onBikeConfigChange: (config: BikeConfig) => void;
}

/**
 * Parses a coordinate string input into a Coordinate object if valid.
 */
function parseCoordinateInput(value: string): Coordinate | null {
  const parts = value.split(/[,;\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (
      !Number.isNaN(lat) &&
      !Number.isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Formats a coordinate into a comma-separated latitude and longitude string.
 */
function formatCoordinate(coord: Coordinate | null): string {
  if (!coord) return '';
  return `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`;
}

/**
 * Panel containing route location inputs, swap button, active bike profiles,
 * and OSM fetching statuses.
 */
export const RoutingConfigPanel: React.FC<RoutingConfigPanelProps> = ({
  startCoord,
  endCoord,
  onSwapCoords,
  onSetStartCoord,
  onSetEndCoord,
  isFetchingOSM,
  bikeConfig,
  onBikeConfigChange,
}) => {
  const [prevStartCoord, setPrevStartCoord] = useState<Coordinate | null>(startCoord);
  const [startInput, setStartInput] = useState(() => formatCoordinate(startCoord));

  const [prevEndCoord, setPrevEndCoord] = useState<Coordinate | null>(endCoord);
  const [endInput, setEndInput] = useState(() => formatCoordinate(endCoord));

  if (startCoord?.lat !== prevStartCoord?.lat || startCoord?.lng !== prevStartCoord?.lng) {
    setPrevStartCoord(startCoord);
    setStartInput(formatCoordinate(startCoord));
  }

  if (endCoord?.lat !== prevEndCoord?.lat || endCoord?.lng !== prevEndCoord?.lng) {
    setPrevEndCoord(endCoord);
    setEndInput(formatCoordinate(endCoord));
  }

  const handleStartBlur = () => {
    const parsed = parseCoordinateInput(startInput);
    if (parsed && onSetStartCoord) {
      onSetStartCoord(parsed);
    } else {
      setStartInput(formatCoordinate(startCoord));
    }
  };

  const handleStartKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleStartBlur();
    }
  };

  const handleEndBlur = () => {
    const parsed = parseCoordinateInput(endInput);
    if (parsed && onSetEndCoord) {
      onSetEndCoord(parsed);
    } else {
      setEndInput(formatCoordinate(endCoord));
    }
  };

  const handleEndKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEndBlur();
    }
  };

  return (
    <>
      {/* Start / Destination Route Points & Swap */}
      <section className="ciclista-card ciclista-route-locations-card">
        <div className="ciclista-route-locations-header">
          <h2>
            <MapPin size={16} className="ciclista-route-locations-header-icon" />
            Route Points
          </h2>
        </div>
        <div className="ciclista-route-locations-body">
          <div className="ciclista-route-locations-fields">
            <div className="ciclista-form-group ciclista-route-location-form-group">
              <label className="ciclista-label" htmlFor="route-start-input">
                Start
              </label>
              <input
                id="route-start-input"
                className="ciclista-input ciclista-route-location-input"
                type="text"
                value={startInput}
                placeholder="Click map or enter lat, lng"
                onChange={(e) => setStartInput(e.target.value)}
                onBlur={handleStartBlur}
                onKeyDown={handleStartKeyDown}
              />
            </div>
            <div className="ciclista-form-group ciclista-route-location-form-group">
              <label className="ciclista-label" htmlFor="route-end-input">
                Destination
              </label>
              <input
                id="route-end-input"
                className="ciclista-input ciclista-route-location-input"
                type="text"
                value={endInput}
                placeholder="Click map or enter lat, lng"
                onChange={(e) => setEndInput(e.target.value)}
                onBlur={handleEndBlur}
                onKeyDown={handleEndKeyDown}
              />
            </div>
          </div>
          <button
            type="button"
            className="ciclista-btn ciclista-btn--secondary ciclista-route-swap-btn"
            onClick={onSwapCoords}
            aria-label="Swap start and destination"
            title="Swap start and destination"
          >
            <ArrowUpDown size={16} />
          </button>
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
