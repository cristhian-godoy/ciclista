import React, { useState } from 'react';

import type { Coordinate } from '../core/common/types';
import type { BikeConfig, BikeProfileId } from '../core/config';
import { ArrowUpDown, Bike, MapPin, Plus, RefreshCw, Settings, Trash2, Zap } from './common/Icon';
import { SegmentedControl } from './common/SegmentedControl';

/**
 * Properties for the RoutingConfigPanel component.
 */
export interface RoutingConfigPanelProps {
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  waypoints?: Coordinate[];
  onSwapCoords?: () => void;
  onSetStartCoord?: (coord: Coordinate) => void;
  onSetEndCoord?: (coord: Coordinate) => void;
  onAddWaypoint?: () => void;
  onRemoveWaypoint?: (index: number) => void;
  onUpdateWaypoint?: (index: number, coord: Coordinate) => void;
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

interface WaypointItemProps {
  index: number;
  coord: Coordinate;
  onUpdate?: (coord: Coordinate) => void;
  onRemove?: () => void;
}

const WaypointItem: React.FC<WaypointItemProps> = ({ index, coord, onUpdate, onRemove }) => {
  const [val, setVal] = useState(() =>
    coord.lat === 0 && coord.lng === 0 ? '' : formatCoordinate(coord),
  );

  const handleBlur = () => {
    const parsed = parseCoordinateInput(val);
    if (parsed && onUpdate) {
      onUpdate(parsed);
    } else {
      setVal(coord.lat === 0 && coord.lng === 0 ? '' : formatCoordinate(coord));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <div className="ciclista-form-group ciclista-route-location-form-group ciclista-waypoint-row">
      <div className="ciclista-waypoint-field">
        <label className="ciclista-label" htmlFor={`route-stop-${index}-input`}>
          Stop {index + 1}
        </label>
        <input
          id={`route-stop-${index}-input`}
          className="ciclista-input ciclista-route-location-input"
          type="text"
          value={val}
          placeholder="Enter stop lat, lng"
          onChange={(e) => setVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </div>
      <button
        type="button"
        className="ciclista-btn ciclista-btn--secondary ciclista-waypoint-remove-btn"
        onClick={onRemove}
        aria-label={`Remove stop ${index + 1}`}
        title={`Remove stop ${index + 1}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

/**
 * Panel containing route location inputs, multi-stop waypoints, swap button,
 * active bike profiles with custom speed & turn penalties, and OSM fetching statuses.
 */
export const RoutingConfigPanel: React.FC<RoutingConfigPanelProps> = ({
  startCoord,
  endCoord,
  waypoints = [],
  onSwapCoords,
  onSetStartCoord,
  onSetEndCoord,
  onAddWaypoint,
  onRemoveWaypoint,
  onUpdateWaypoint,
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

  const isCustomOrRoad = bikeConfig.id === 'custom' || bikeConfig.id === 'road';

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

            {/* Intermediate Multi-Stop Waypoints */}
            {waypoints.map((wp, idx) => (
              <WaypointItem
                key={idx}
                index={idx}
                coord={wp}
                onUpdate={(c) => onUpdateWaypoint?.(idx, c)}
                onRemove={() => onRemoveWaypoint?.(idx)}
              />
            ))}

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

            {onAddWaypoint && (
              <button
                type="button"
                className="ciclista-btn ciclista-btn--secondary ciclista-add-stop-btn"
                onClick={onAddWaypoint}
                aria-label="+ Add Stop"
              >
                <Plus size={14} />
                <span>+ Add Stop</span>
              </button>
            )}
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
        <SegmentedControl
          options={[
            {
              key: 'normal',
              label: 'Standard',
              icon: <Bike size={12} aria-label="Standard Icon" />,
            },
            {
              key: 'road',
              label: 'Road',
              icon: <Zap size={12} aria-label="Road Icon" />,
            },
            {
              key: 'ebike',
              label: 'E-Bike',
              icon: <Zap size={12} aria-label="E-Bike Icon" />,
            },
            {
              key: 'slow',
              label: 'Cargo',
              icon: <Bike size={12} aria-label="Cargo Icon" />,
            },
            {
              key: 'custom',
              label: 'Custom',
              icon: <Settings size={12} aria-label="Custom Icon" />,
            },
          ]}
          value={bikeConfig.id}
          onChange={(id) => onBikeConfigChange({ ...bikeConfig, id: id as BikeProfileId })}
          showDescription={false}
          ariaLabel="Bike Profile Selector"
        />

        {/* Dynamic Road & Custom Bike Profile Settings & Turn Penalties */}
        {isCustomOrRoad && (
          <div className="ciclista-bike-custom-settings">
            <div className="ciclista-form-group">
              <label className="ciclista-label" htmlFor="custom-bike-speed">
                Speed (km/h)
              </label>
              <input
                id="custom-bike-speed"
                className="ciclista-input"
                type="number"
                min={5}
                max={60}
                value={bikeConfig.customSpeedKmh ?? (bikeConfig.id === 'road' ? 30 : 18)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onBikeConfigChange({
                    ...bikeConfig,
                    customSpeedKmh: isNaN(val) ? undefined : val,
                  });
                }}
              />
            </div>

            <div className="ciclista-form-group">
              <label className="ciclista-label" htmlFor="custom-bike-weight">
                Weight (kg)
              </label>
              <input
                id="custom-bike-weight"
                className="ciclista-input"
                type="number"
                min={5}
                max={200}
                value={bikeConfig.weightKg ?? 75}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onBikeConfigChange({
                    ...bikeConfig,
                    weightKg: isNaN(val) ? undefined : val,
                  });
                }}
              />
            </div>

            <div className="ciclista-form-group">
              <label className="ciclista-label">Turn Penalties (seconds)</label>
              <div className="ciclista-grid-2col">
                <div>
                  <label
                    className="ciclista-label ciclista-label--sm"
                    htmlFor="custom-right-turn-penalty"
                  >
                    Right Turn
                  </label>
                  <input
                    id="custom-right-turn-penalty"
                    className="ciclista-input"
                    type="number"
                    min={0}
                    max={60}
                    value={bikeConfig.turnPenalties?.rightTurnPenaltySeconds ?? 1}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBikeConfigChange({
                        ...bikeConfig,
                        turnPenalties: {
                          ...bikeConfig.turnPenalties,
                          rightTurnPenaltySeconds: isNaN(val) ? 0 : val,
                        },
                      });
                    }}
                  />
                </div>
                <div>
                  <label
                    className="ciclista-label ciclista-label--sm"
                    htmlFor="custom-left-turn-penalty"
                  >
                    Left Turn
                  </label>
                  <input
                    id="custom-left-turn-penalty"
                    className="ciclista-input"
                    type="number"
                    min={0}
                    max={60}
                    value={bikeConfig.turnPenalties?.leftTurnPenaltySeconds ?? 4}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBikeConfigChange({
                        ...bikeConfig,
                        turnPenalties: {
                          ...bikeConfig.turnPenalties,
                          leftTurnPenaltySeconds: isNaN(val) ? 0 : val,
                        },
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="ciclista-form-group">
              <label className="ciclista-label">Surface Multipliers</label>
              <div className="ciclista-grid-2col">
                <div>
                  <label
                    className="ciclista-label ciclista-label--sm"
                    htmlFor="custom-gravel-multiplier"
                  >
                    Gravel
                  </label>
                  <input
                    id="custom-gravel-multiplier"
                    className="ciclista-input"
                    type="number"
                    step={0.05}
                    min={0.1}
                    max={1}
                    value={
                      bikeConfig.surfacePreferences?.gravelSpeedMultiplier ??
                      (bikeConfig.id === 'road' ? 0.4 : 0.8)
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBikeConfigChange({
                        ...bikeConfig,
                        surfacePreferences: {
                          ...bikeConfig.surfacePreferences,
                          gravelSpeedMultiplier: isNaN(val) ? 0.8 : val,
                        },
                      });
                    }}
                  />
                </div>
                <div>
                  <label
                    className="ciclista-label ciclista-label--sm"
                    htmlFor="custom-cobblestone-multiplier"
                  >
                    Cobblestone
                  </label>
                  <input
                    id="custom-cobblestone-multiplier"
                    className="ciclista-input"
                    type="number"
                    step={0.05}
                    min={0.1}
                    max={1}
                    value={
                      bikeConfig.surfacePreferences?.cobblestoneSpeedMultiplier ??
                      (bikeConfig.id === 'road' ? 0.6 : 0.75)
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBikeConfigChange({
                        ...bikeConfig,
                        surfacePreferences: {
                          ...bikeConfig.surfacePreferences,
                          cobblestoneSpeedMultiplier: isNaN(val) ? 0.75 : val,
                        },
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
};
