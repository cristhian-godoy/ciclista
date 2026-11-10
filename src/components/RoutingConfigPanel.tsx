import React, { useState } from 'react';

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
  Sliders,
  Trash2,
  Zap,
} from './common/Icon';
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
  onReorderWaypoints?: (fromIndex: number, toIndex: number) => void;
  isPlacingStop?: boolean;
  placingStopIndex?: number | null;
  onStartPlacingStop?: (index?: number) => void;
  isFetchingOSM: boolean;
  bikeConfig: BikeConfig;
  onBikeConfigChange: (config: BikeConfig) => void;
  /**
   * Optional callback to open the dedicated Bike Profile and Road Rules management modal.
   */
  onOpenBikeRulesModal?: (tab?: 'bike' | 'rules') => void;
}

/**
 * Parses a coordinate string input into a Coordinate object if valid.
 */
function parseCoordinateInput(value: string): Coordinate | null {
  const parts = value.split(/[,;\s]+/).filter(Boolean);
  const p0 = parts[0];
  const p1 = parts[1];
  if (p0 && p1) {
    const lat = parseFloat(p0);
    const lng = parseFloat(p1);
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
  if (
    !coord ||
    typeof coord.lat !== 'number' ||
    typeof coord.lng !== 'number' ||
    isNaN(coord.lat) ||
    isNaN(coord.lng)
  ) {
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
  onUpdate,
  onRemove,
  onPickOnMap,
  onMoveUp,
  onMoveDown,
}) => {
  const isCoordValid =
    coord &&
    typeof coord.lat === 'number' &&
    typeof coord.lng === 'number' &&
    !isNaN(coord.lat) &&
    !isNaN(coord.lng);
  const isZero = isCoordValid && coord.lat === 0 && coord.lng === 0;
  const [val, setVal] = useState(() => (isZero || !isCoordValid ? '' : formatCoordinate(coord)));

  const handleBlur = () => {
    const parsed = parseCoordinateInput(val);
    if (parsed && onUpdate) {
      onUpdate(parsed);
    } else {
      setVal(isZero || !isCoordValid ? '' : formatCoordinate(coord));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

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
          className="ciclista-input ciclista-route-location-input"
          type="text"
          value={val}
          placeholder="Click map or enter lat, lng"
          onChange={(e) => setVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
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
  onOpenBikeRulesModal,
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
                  disabled={!startCoord || !endCoord || isPlacingStop}
                  aria-label="Add Stop"
                  title={
                    !startCoord || !endCoord
                      ? 'Set start and destination before adding intermediate stops'
                      : isPlacingStop
                        ? 'Click on the map to place Stop'
                        : 'Add Stop'
                  }
                >
                  <Plus size={14} />
                  <span>Add Stop</span>
                </button>
                {(!startCoord || !endCoord) && (
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
      <section className="ciclista-form-group ciclista-bike-config-section">
        <div className="ciclista-bike-header-row">
          <label className="ciclista-label">Bike Profile</label>
          {onOpenBikeRulesModal && (
            <button
              type="button"
              className="ciclista-btn ciclista-btn--secondary ciclista-btn--sm ciclista-bike-tune-btn"
              onClick={() => onOpenBikeRulesModal('bike')}
              aria-label="Customize bike profile parameters and road rules"
              title="Customize speed, turn penalties, and road rules"
              data-testid="customize-bike-rules-btn"
            >
              <Sliders size={12} />
              <span>Customize</span>
            </button>
          )}
        </div>
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

        <div className="ciclista-bike-summary-row">
          <span className="ciclista-bike-summary-pill" data-testid="bike-profile-summary-pill">
            {bikeConfig.id === 'road'
              ? `${bikeConfig.customSpeedKmh ?? 30} km/h • Road setup`
              : bikeConfig.id === 'ebike'
                ? `${bikeConfig.customSpeedKmh ?? 25} km/h • E-Bike assist`
                : bikeConfig.id === 'slow'
                  ? `${bikeConfig.customSpeedKmh ?? 15} km/h • Cargo setup`
                  : bikeConfig.id === 'custom'
                    ? `${bikeConfig.customSpeedKmh ?? 18} km/h • Custom tune`
                    : `${bikeConfig.customSpeedKmh ?? 18} km/h • Standard`}
          </span>
          {onOpenBikeRulesModal && (
            <button
              type="button"
              className="ciclista-link-btn"
              onClick={() => onOpenBikeRulesModal('bike')}
              data-testid="tune-parameters-link"
            >
              Tune parameters &amp; rules &rarr;
            </button>
          )}
        </div>
      </section>
    </>
  );
};
