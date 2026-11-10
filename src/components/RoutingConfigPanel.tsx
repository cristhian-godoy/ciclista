import React, { useMemo, useState } from 'react';

import type { Coordinate } from '../core/common/types';
import type { BikeConfig, BikeProfile } from '../core/config';
import { DEFAULT_BIKES } from '../core/config';
import type { Landmark } from '../core/landmarks/types';
import { getCategoryIcon } from '../utils/formatters';
import { Badge } from './common/Badge';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Crosshair,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from './common/Icon';

/**
 * Properties for the RoutingConfigPanel component.
 */
export interface RoutingConfigPanelProps {
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  waypoints?: Coordinate[];
  places?: Landmark[];
  onSwapCoords?: () => void;
  onSetStartCoord?: (coord: Coordinate) => void;
  onSetEndCoord?: (coord: Coordinate) => void;
  onClearStartCoord?: () => void;
  onClearEndCoord?: () => void;
  onPickStartOnMap?: () => void;
  onPickEndOnMap?: () => void;
  onStartPlacingStart?: () => void;
  onStartPlacingEnd?: () => void;
  isPlacingStart?: boolean;
  isPlacingEnd?: boolean;
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
   * Available bike profiles for selection (defaults to DEFAULT_BIKES).
   */
  bikes?: BikeProfile[];
  /**
   * Currently active bike profile id (defaults to bikes[0]?.id ?? bikeConfig.id).
   */
  activeBikeId?: string;
  /**
   * Callback fired when a bike profile is selected.
   */
  onSelectBike?: (id: string) => void;
  /**
   * Optional callback to open the dedicated Bike Profile and Road Rules management modal.
   * @deprecated
   */
  onOpenBikeRulesModal?: (tab?: 'bike' | 'rules') => void;
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

interface RouteLocationInputProps {
  id: string;
  label: string;
  coord: Coordinate | null;
  places?: Landmark[];
  onSelectPlace: (coord: Coordinate) => void;
  onClear?: () => void;
  onPickOnMap?: () => void;
  isPlacing?: boolean;
}

const RouteLocationInput: React.FC<RouteLocationInputProps> = ({
  id,
  label,
  coord,
  places = [],
  onSelectPlace,
  onClear,
  onPickOnMap,
  isPlacing = false,
}) => {
  const matchedPlace = useMemo(() => {
    if (!coord || !places || places.length === 0) return null;
    return (
      places.find(
        (p) => Math.abs(p.lat - coord.lat) < 1e-5 && Math.abs(p.lng - coord.lng) < 1e-5,
      ) ?? null
    );
  }, [coord, places]);

  const [selectedPlace, setSelectedPlace] = useState<Landmark | null>(() => matchedPlace);
  const [searchTerm, setSearchTerm] = useState(() =>
    matchedPlace ? matchedPlace.name : formatCoordinate(coord),
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [prevCoord, setPrevCoord] = useState<Coordinate | null>(coord);

  // Synchronize when external coordinate changes
  if (coord?.lat !== prevCoord?.lat || coord?.lng !== prevCoord?.lng) {
    setPrevCoord(coord);
    const m =
      places.find(
        (p) => coord && Math.abs(p.lat - coord.lat) < 1e-5 && Math.abs(p.lng - coord.lng) < 1e-5,
      ) ?? null;
    setSelectedPlace(m);
    setSearchTerm(m ? m.name : formatCoordinate(coord));
    setIsSearching(false);
  }

  const currentPlace = selectedPlace ?? matchedPlace;

  const filteredPlaces = useMemo(() => {
    if (!places || places.length === 0) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!isSearching || q === '') {
      return places;
    }
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    );
  }, [places, searchTerm, isSearching]);

  const handleSelect = (place: Landmark) => {
    setSelectedPlace(place);
    setSearchTerm(place.name);
    setIsSearching(false);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelectPlace({ lat: place.lat, lng: place.lng });
  };

  const handleClear = () => {
    setSelectedPlace(null);
    setSearchTerm('');
    setIsSearching(false);
    setIsOpen(false);
    setActiveIndex(-1);
    onClear?.();
  };

  const handleFocus = () => {
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleBlur = () => {
    setIsOpen(false);
    setIsSearching(false);
    setActiveIndex(-1);
    setSearchTerm(currentPlace ? currentPlace.name : formatCoordinate(coord));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredPlaces.length === 0) return;
      setActiveIndex((prev) => (prev < filteredPlaces.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredPlaces.length === 0) return;
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredPlaces.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredPlaces.length) {
        handleSelect(filteredPlaces[activeIndex]);
      } else if (filteredPlaces.length === 1) {
        handleSelect(filteredPlaces[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setIsSearching(false);
      setActiveIndex(-1);
      setSearchTerm(currentPlace ? currentPlace.name : formatCoordinate(coord));
    }
  };

  const hasValue = Boolean(coord || searchTerm.trim().length > 0);

  return (
    <div className="ciclista-form-group ciclista-route-location-form-group ciclista-route-endpoint-row">
      <div className="ciclista-route-endpoint-field">
        <label className="ciclista-label" htmlFor={id}>
          {label}
        </label>
        <div className="ciclista-route-input-wrapper">
          {currentPlace && (
            <span className="ciclista-route-input-icon" aria-hidden="true">
              {getCategoryIcon(currentPlace.category, 14)}
            </span>
          )}
          <input
            id={id}
            name={id}
            className={`ciclista-input ciclista-route-location-input ${
              currentPlace ? 'ciclista-has-category-icon' : ''
            } ${hasValue ? 'ciclista-has-clear-btn' : ''}`}
            type="text"
            value={searchTerm}
            placeholder="Search saved place or pick on map"
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsSearching(true);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            autoComplete="off"
          />
          {hasValue && (
            <button
              type="button"
              className="ciclista-route-inline-clear-btn"
              onClick={handleClear}
              aria-label={`Clear ${label.toLowerCase()}`}
              title={`Clear ${label.toLowerCase()}`}
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            className={`ciclista-btn ciclista-btn--secondary ciclista-route-location-action-btn ${
              isPlacing ? 'ciclista-btn--active' : ''
            }`}
            onClick={onPickOnMap}
            aria-label={`Pick ${label.toLowerCase()} on map`}
            title={`Pick ${label.toLowerCase()} on map`}
          >
            <Crosshair size={14} />
          </button>

          {isOpen && (
            <div
              className="ciclista-autocomplete-dropdown-container"
              onMouseDown={(e) => e.preventDefault()}
            >
              {filteredPlaces.length > 0 ? (
                <ul
                  id={`${id}-autocomplete-list`}
                  role="listbox"
                  className="ciclista-autocomplete-dropdown"
                  aria-label={`Matching saved places for ${label}`}
                >
                  {filteredPlaces.map((place, index) => {
                    const isHighlighted = index === activeIndex;
                    return (
                      <li
                        key={place.id}
                        id={`${id}-option-${index}`}
                        role="option"
                        aria-selected={isHighlighted}
                        className={`ciclista-autocomplete-item ${
                          isHighlighted ? 'ciclista-autocomplete-item--active' : ''
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelect(place);
                        }}
                        onClick={() => handleSelect(place)}
                      >
                        <span className="ciclista-autocomplete-item-icon" aria-hidden="true">
                          {getCategoryIcon(place.category, 16)}
                        </span>
                        <div className="ciclista-autocomplete-item-content">
                          <div className="ciclista-autocomplete-item-header">
                            <span className="ciclista-autocomplete-item-title">{place.name}</span>
                            <Badge
                              size="sm"
                              variant="subtle"
                              className="ciclista-autocomplete-item-badge"
                            >
                              {place.category}
                            </Badge>
                          </div>
                          {place.description && (
                            <div className="ciclista-autocomplete-item-desc">
                              {place.description}
                            </div>
                          )}
                          <div className="ciclista-autocomplete-item-coords">
                            {formatCoordinate({ lat: place.lat, lng: place.lng })}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="ciclista-autocomplete-dropdown ciclista-autocomplete-empty">
                  {places.length === 0 ? 'No saved places' : 'No saved places found'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  const isCoordValid =
    coord &&
    typeof coord.lat === 'number' &&
    typeof coord.lng === 'number' &&
    !isNaN(coord.lat) &&
    !isNaN(coord.lng);
  const isZero = isCoordValid && coord.lat === 0 && coord.lng === 0;
  const val = isZero || !isCoordValid ? '' : formatCoordinate(coord);

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
          name={`routeStop${index + 1}`}
          className="ciclista-input ciclista-route-location-input"
          type="text"
          value={val}
          placeholder="Click map to set location"
          readOnly
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
  places = [],
  onSwapCoords,
  onSetStartCoord,
  onSetEndCoord,
  onClearStartCoord,
  onClearEndCoord,
  onPickStartOnMap,
  onPickEndOnMap,
  onStartPlacingStart,
  onStartPlacingEnd,
  isPlacingStart: isPlacingStartProp,
  isPlacingEnd: isPlacingEndProp,
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
  bikes = DEFAULT_BIKES,
  activeBikeId,
  onSelectBike,
}) => {
  const availableBikes = bikes;
  const currentBikeId =
    activeBikeId ??
    availableBikes.find((b) => b.id === bikeConfig.id)?.id ??
    availableBikes[0]?.id ??
    bikeConfig.id;

  const [internalPlacingStart, setInternalPlacingStart] = useState(false);
  const [internalPlacingEnd, setInternalPlacingEnd] = useState(false);

  const isPlacingStart =
    isPlacingStartProp !== undefined ? isPlacingStartProp : internalPlacingStart;
  const isPlacingEnd = isPlacingEndProp !== undefined ? isPlacingEndProp : internalPlacingEnd;

  const handlePickStart = () => {
    if (isPlacingStartProp === undefined) {
      setInternalPlacingStart((prev) => !prev);
    }
    const fn = onPickStartOnMap ?? onStartPlacingStart;
    fn?.();
  };

  const handlePickEnd = () => {
    if (isPlacingEndProp === undefined) {
      setInternalPlacingEnd((prev) => !prev);
    }
    const fn = onPickEndOnMap ?? onStartPlacingEnd;
    fn?.();
  };

  const handleClearStart = () => {
    if (onClearStartCoord) {
      onClearStartCoord();
    } else if (onSetStartCoord) {
      (onSetStartCoord as (c: Coordinate | null) => void)(null);
    }
  };

  const handleClearEnd = () => {
    if (onClearEndCoord) {
      onClearEndCoord();
    } else if (onSetEndCoord) {
      (onSetEndCoord as (c: Coordinate | null) => void)(null);
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
          <button
            type="button"
            className="ciclista-btn ciclista-btn--secondary ciclista-route-swap-btn"
            onClick={onSwapCoords}
            aria-label="Swap start and destination"
            title="Swap start and destination"
          >
            <ArrowUpDown size={14} />
          </button>
        </div>
        <div className="ciclista-route-locations-body">
          <div className="ciclista-route-locations-fields">
            <RouteLocationInput
              id="route-start-input"
              label="Start"
              coord={startCoord}
              places={places}
              onSelectPlace={(c) => onSetStartCoord?.(c)}
              onClear={handleClearStart}
              onPickOnMap={handlePickStart}
              isPlacing={isPlacingStart}
            />

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

            <RouteLocationInput
              id="route-end-input"
              label="Destination"
              coord={endCoord}
              places={places}
              onSelectPlace={(c) => onSetEndCoord?.(c)}
              onClear={handleClearEnd}
              onPickOnMap={handlePickEnd}
              isPlacing={isPlacingEnd}
            />

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

            <div className="ciclista-form-group ciclista-route-location-form-group ciclista-route-bike-row">
              <label className="ciclista-label" htmlFor="route-bike-select">
                Bike
              </label>
              <select
                id="route-bike-select"
                name="routeBike"
                className="ciclista-input ciclista-select ciclista-route-bike-select"
                value={currentBikeId}
                aria-label="Bike"
                onChange={(e) => {
                  const nextId = e.target.value;
                  onSelectBike?.(nextId);
                  const chosen = availableBikes.find((b) => b.id === nextId);
                  if (chosen) {
                    onBikeConfigChange({
                      ...bikeConfig,
                      id: chosen.id,
                      customSpeedKmh: chosen.speedKmh,
                      weightKg: chosen.weightKg,
                      surfacePreferences: chosen.surfacePreferences,
                      turnPenalties: chosen.turnPenalties,
                    });
                  }
                }}
              >
                {availableBikes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {isFetchingOSM && (
          <div className="config-fetching-container">
            <RefreshCw size={12} className="spin" />
            <span>Fetching street network from Overpass...</span>
          </div>
        )}
      </section>
    </>
  );
};
