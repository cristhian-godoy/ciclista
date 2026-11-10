import React from 'react';

import type { Coordinate } from '../core/common/types';
import type { BikeConfig, BikeProfileId } from '../core/config';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bike,
  Crosshair,
  MapPin,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  X,
  Zap,
} from './common/Icon';
import { SegmentedControl } from './common/SegmentedControl';

/**
 * Properties for the RoutingConfigPanel component.
 */
export interface RoutingConfigPanelProps {
  /**
   * Starting geographic coordinate for routing calculations.
   */
  startCoord: Coordinate | null;
  /**
   * Destination geographic coordinate for routing calculations.
   */
  endCoord: Coordinate | null;
  /**
   * Intermediate waypoints positioned between start and destination.
   */
  waypoints?: Coordinate[];
  /**
   * Callback fired when swapping start and destination coordinates.
   */
  onSwapCoords?: () => void;
  /**
   * Callback fired to update the start coordinate.
   */
  onSetStartCoord?: (coord: Coordinate) => void;
  /**
   * Callback fired to update the destination coordinate.
   */
  onSetEndCoord?: (coord: Coordinate) => void;
  /**
   * Callback fired when clearing the start coordinate.
   */
  onClearStartCoord?: () => void;
  /**
   * Callback fired when clearing the destination coordinate.
   */
  onClearEndCoord?: () => void;
  /**
   * Callback fired to initiate map placement for the start coordinate.
   */
  onPickStartOnMap?: () => void;
  /**
   * Callback fired to initiate map placement for the destination coordinate.
   */
  onPickEndOnMap?: () => void;
  /**
   * Whether map placement mode is currently active for start location.
   */
  isPlacingStart?: boolean;
  /**
   * Whether map placement mode is currently active for destination location.
   */
  isPlacingEnd?: boolean;
  /**
   * Callback fired to append a new intermediate waypoint.
   */
  onAddWaypoint?: () => void;
  /**
   * Callback fired to remove an intermediate waypoint by index.
   */
  onRemoveWaypoint?: (index: number) => void;
  /**
   * Callback fired to update an intermediate waypoint coordinate.
   */
  onUpdateWaypoint?: (index: number, coord: Coordinate) => void;
  /**
   * Callback fired to reorder intermediate waypoints.
   */
  onReorderWaypoints?: (fromIndex: number, toIndex: number) => void;
  /**
   * Whether intermediate stop placement mode is active.
   */
  isPlacingStop?: boolean;
  /**
   * Index of intermediate stop being repositioned on the map.
   */
  placingStopIndex?: number | null;
  /**
   * Callback fired to initiate intermediate stop placement on map.
   */
  onStartPlacingStop?: (index?: number) => void;
  /**
   * Whether street network data is actively being fetched from Overpass.
   */
  isFetchingOSM: boolean;
  /**
   * Active bicycle profile configuration.
   */
  bikeConfig: BikeConfig;
  /**
   * Callback fired when bicycle profile settings change.
   */
  onBikeConfigChange: (config: BikeConfig) => void;
}

/**
 * Checks whether a coordinate is defined with valid non-zero latitude and longitude values.
 */
function isCoordinateSet(coord: Coordinate | null | undefined): boolean {
  return Boolean(
    coord &&
    typeof coord.lat === 'number' &&
    typeof coord.lng === 'number' &&
    !isNaN(coord.lat) &&
    !isNaN(coord.lng) &&
    !(coord.lat === 0 && coord.lng === 0),
  );
}

/**
 * Formats a coordinate into a comma-separated latitude and longitude string.
 */
function formatCoordinate(coord: Coordinate | null | undefined): string {
  if (!isCoordinateSet(coord) || !coord) {
    return '';
  }
  return `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`;
}

interface WaypointItemProps {
  index: number;
  totalWaypoints: number;
  coord: Coordinate;
  isPlacingThisStop?: boolean;
  onUpdate?: (coord: Coordinate) => void;
  onRemove?: () => void;
  onPickOnMap?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const WaypointItem: React.FC<WaypointItemProps> = ({
  index,
  totalWaypoints,
  coord,
  isPlacingThisStop,
  onRemove,
  onPickOnMap,
  onMoveUp,
  onMoveDown,
}) => {
  const displayValue = formatCoordinate(coord);

  return (
    <div className="ciclista-form-group ciclista-route-location-form-group ciclista-waypoint-row">
      <span className="ciclista-waypoint-badge" aria-hidden="true">
        {index + 1}
      </span>
      <div className="ciclista-waypoint-field">
        <label className="ciclista-label" htmlFor={`route-stop-${index}-input`}>
          Stop {index + 1}
        </label>
        <input
          id={`route-stop-${index}-input`}
          className="ciclista-input ciclista-route-location-input ciclista-route-readonly-input"
          type="text"
          value={displayValue}
          placeholder="Click map to set location"
          readOnly
          onClick={onPickOnMap}
        />
      </div>
      <div className="ciclista-waypoint-actions">
        <button
          type="button"
          className={`ciclista-btn ciclista-btn--secondary ciclista-waypoint-action-btn ${
            isPlacingThisStop ? 'ciclista-btn--active' : ''
          }`}
          onClick={onPickOnMap}
          aria-label={`Pick stop ${index + 1} on map`}
          title={`Pick stop ${index + 1} on map`}
        >
          <Crosshair size={14} />
        </button>
        <button
          type="button"
          className="ciclista-btn ciclista-btn--secondary ciclista-waypoint-action-btn"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`Move stop ${index + 1} up`}
          title={`Move stop ${index + 1} up`}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          className="ciclista-btn ciclista-btn--secondary ciclista-waypoint-action-btn"
          onClick={onMoveDown}
          disabled={index === totalWaypoints - 1}
          aria-label={`Move stop ${index + 1} down`}
          title={`Move stop ${index + 1} down`}
        >
          <ArrowDown size={14} />
        </button>
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
  onClearStartCoord,
  onClearEndCoord,
  onPickStartOnMap,
  onPickEndOnMap,
  isPlacingStart = false,
  isPlacingEnd = false,
  onAddWaypoint,
  onRemoveWaypoint,
  onUpdateWaypoint,
  onReorderWaypoints,
  isPlacingStop = false,
  placingStopIndex = null,
  onStartPlacingStop,
  isFetchingOSM,
  bikeConfig,
  onBikeConfigChange,
}) => {
  const startValue = formatCoordinate(startCoord);
  const endValue = formatCoordinate(endCoord);

  const handleClearStart = () => {
    if (onClearStartCoord) {
      onClearStartCoord();
    } else {
      (onSetStartCoord as unknown as ((coord: Coordinate | null) => void) | undefined)?.(null);
    }
  };

  const handleClearEnd = () => {
    if (onClearEndCoord) {
      onClearEndCoord();
    } else {
      (onSetEndCoord as unknown as ((coord: Coordinate | null) => void) | undefined)?.(null);
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
            <div className="ciclista-form-group ciclista-route-location-form-group ciclista-route-endpoint-row">
              <div className="ciclista-route-endpoint-field">
                <label className="ciclista-label" htmlFor="route-start-input">
                  Start
                </label>
                <input
                  id="route-start-input"
                  className="ciclista-input ciclista-route-location-input ciclista-route-readonly-input"
                  type="text"
                  value={startValue}
                  placeholder="Click map to set location"
                  readOnly
                  onClick={onPickStartOnMap}
                />
              </div>
              <div className="ciclista-route-endpoint-actions">
                <button
                  type="button"
                  className={`ciclista-btn ciclista-btn--secondary ciclista-route-location-action-btn ${
                    isPlacingStart ? 'ciclista-btn--active' : ''
                  }`}
                  onClick={onPickStartOnMap}
                  aria-label="Pick start on map"
                  title="Pick start on map"
                >
                  <Crosshair size={14} />
                </button>
                {isCoordinateSet(startCoord) && (
                  <button
                    type="button"
                    className="ciclista-btn ciclista-btn--secondary ciclista-route-location-action-btn ciclista-route-location-clear-btn"
                    onClick={handleClearStart}
                    aria-label="Clear start location"
                    title="Clear start location"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Intermediate Multi-Stop Waypoints */}
            {waypoints.map((wp, idx) => (
              <WaypointItem
                key={idx}
                index={idx}
                totalWaypoints={waypoints.length}
                coord={wp}
                isPlacingThisStop={isPlacingStop && placingStopIndex === idx}
                onUpdate={(c) => onUpdateWaypoint?.(idx, c)}
                onRemove={() => onRemoveWaypoint?.(idx)}
                onPickOnMap={() => onStartPlacingStop?.(idx)}
                onMoveUp={() => onReorderWaypoints?.(idx, idx - 1)}
                onMoveDown={() => onReorderWaypoints?.(idx, idx + 1)}
              />
            ))}

            <div className="ciclista-form-group ciclista-route-location-form-group ciclista-route-endpoint-row">
              <div className="ciclista-route-endpoint-field">
                <label className="ciclista-label" htmlFor="route-end-input">
                  Destination
                </label>
                <input
                  id="route-end-input"
                  className="ciclista-input ciclista-route-location-input ciclista-route-readonly-input"
                  type="text"
                  value={endValue}
                  placeholder="Click map to set location"
                  readOnly
                  onClick={onPickEndOnMap}
                />
              </div>
              <div className="ciclista-route-endpoint-actions">
                <button
                  type="button"
                  className={`ciclista-btn ciclista-btn--secondary ciclista-route-location-action-btn ${
                    isPlacingEnd ? 'ciclista-btn--active' : ''
                  }`}
                  onClick={onPickEndOnMap}
                  aria-label="Pick destination on map"
                  title="Pick destination on map"
                >
                  <Crosshair size={14} />
                </button>
                {isCoordinateSet(endCoord) && (
                  <button
                    type="button"
                    className="ciclista-btn ciclista-btn--secondary ciclista-route-location-action-btn ciclista-route-location-clear-btn"
                    onClick={handleClearEnd}
                    aria-label="Clear destination location"
                    title="Clear destination location"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {onAddWaypoint && (
              <div className="ciclista-add-stop-container">
                <button
                  type="button"
                  className="ciclista-btn ciclista-btn--secondary ciclista-add-stop-btn"
                  onClick={() => {
                    if (onStartPlacingStop) {
                      onStartPlacingStop();
                    } else {
                      onAddWaypoint?.();
                    }
                  }}
                  disabled={
                    !isCoordinateSet(startCoord) || !isCoordinateSet(endCoord) || isPlacingStop
                  }
                  aria-label="Add Stop"
                  title={
                    !isCoordinateSet(startCoord) || !isCoordinateSet(endCoord)
                      ? 'Set start and destination before adding intermediate stops'
                      : isPlacingStop
                        ? 'Click on the map to place Stop'
                        : 'Add Stop'
                  }
                >
                  <Plus size={14} />
                  <span>Add Stop</span>
                </button>
                {(!isCoordinateSet(startCoord) || !isCoordinateSet(endCoord)) && (
                  <p className="ciclista-field-helper">
                    Set start and destination before adding intermediate stops
                  </p>
                )}
              </div>
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
