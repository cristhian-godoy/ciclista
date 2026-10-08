import {
  Briefcase,
  Edit2,
  GraduationCap,
  Home,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  Stethoscope,
  Train,
  Trash2,
  Trees,
} from 'lucide-react';
import React, { useContext, useEffect, useMemo, useState } from 'react';

import type { Coordinate } from '../core/common/types';
import { filterLandmarks, LANDMARK_CATEGORIES, sortLandmarks } from '../core/landmarks/landmarks';
import type { LandmarkCategory } from '../core/landmarks/types';
import type { CreatePlaceInput, Place, UpdatePlaceInput } from '../hooks/usePlaces';
import { Toast } from './common/Toast';
import { MapContext } from './map/MapContext';
import { PlaceModal } from './PlaceModal';

/**
 * Returns a corresponding icon component for each place category.
 */
function getCategoryIcon(category: LandmarkCategory, size = 16) {
  switch (category) {
    case 'home':
      return <Home size={size} />;
    case 'work':
      return <Briefcase size={size} />;
    case 'doctor':
      return <Stethoscope size={size} />;
    case 'school':
      return <GraduationCap size={size} />;
    case 'shop':
      return <ShoppingBag size={size} />;
    case 'transit':
      return <Train size={size} />;
    case 'leisure':
      return <Trees size={size} />;
    case 'other':
    default:
      return <MapPin size={size} />;
  }
}

/**
 * Properties for the PlacesPanel component.
 */
export interface PlacesPanelProps {
  /**
   * Existing registered user places.
   */
  places?: Place[];
  /**
   * Alias for places (for backward compatibility).
   */
  landmarks?: Place[];
  /**
   * Callback fired to add a new place.
   */
  onCreatePlace?: (input: CreatePlaceInput) => void;
  /**
   * Alias for onCreatePlace.
   */
  onCreateLandmark?: (input: CreatePlaceInput) => void;
  /**
   * Callback fired to modify an existing place.
   */
  onUpdatePlace?: (id: string, updates: UpdatePlaceInput) => void;
  /**
   * Alias for onUpdatePlace.
   */
  onUpdateLandmark?: (id: string, updates: UpdatePlaceInput) => void;
  /**
   * Callback fired to delete a place.
   */
  onDeletePlace?: (id: string) => void;
  /**
   * Alias for onDeletePlace.
   */
  onDeleteLandmark?: (id: string) => void;
  /**
   * Optional callback to set origin (start) routing marker to place coordinates.
   */
  onSetStartCoord?: (coord: Coordinate) => void;
  /**
   * Optional callback to set destination (end) routing marker to place coordinates.
   */
  onSetEndCoord?: (coord: Coordinate) => void;
  /**
   * Optional callback to center the map on the selected place coordinates.
   */
  onCenterMap?: (coord: Coordinate) => void;
  /**
   * Optional current map center coordinates for fallback creation position.
   */
  currentMapCenter?: Coordinate | null;
  /**
   * Optional active start point coordinates for fallback creation position.
   */
  startCoord?: Coordinate | null;
  /**
   * Optional active destination coordinates for fallback creation position.
   */
  endCoord?: Coordinate | null;
  /**
   * Whether the application is currently in pin placement mode for a new place.
   */
  isPlacingPlace?: boolean;
  /**
   * Callback fired when pin placement mode changes.
   */
  onPlacingPlaceChange?: (isPlacing: boolean) => void;
}

/**
 * Sidebar panel allowing users to define, view, manage, and utilize places
 * for routing and spatial bookmarks.
 */
export const PlacesPanel: React.FC<PlacesPanelProps> = ({
  places: placesProp,
  landmarks: landmarksProp,
  onCreatePlace,
  onCreateLandmark,
  onUpdatePlace,
  onUpdateLandmark,
  onDeletePlace,
  onDeleteLandmark,
  onSetStartCoord,
  onSetEndCoord,
  onCenterMap,
  currentMapCenter,
  startCoord,
  endCoord,
  isPlacingPlace: isPlacingPlaceProp,
  onPlacingPlaceChange: onPlacingPlaceChangeProp,
}) => {
  const mapCtx = useContext(MapContext);

  const places = useMemo(() => placesProp ?? landmarksProp ?? [], [placesProp, landmarksProp]);
  const handleCreate = onCreatePlace ?? onCreateLandmark ?? (() => {});
  const handleUpdate = onUpdatePlace ?? onUpdateLandmark ?? (() => {});
  const handleDelete = onDeletePlace ?? onDeleteLandmark ?? (() => {});

  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [localEditingPlace, setLocalEditingPlace] = useState<Place | null>(null);

  const [localIsPlacingPlace, setLocalIsPlacingPlace] = useState(false);
  const isPlacingPlace = isPlacingPlaceProp ?? mapCtx?.isPlacingPlace ?? localIsPlacingPlace;
  const setIsPlacingPlace =
    onPlacingPlaceChangeProp ?? mapCtx?.setIsPlacingPlace ?? setLocalIsPlacingPlace;

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<LandmarkCategory | 'all'>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'category'>('name');

  const handleStartAddPlace = () => {
    setIsPlacingPlace(true);
  };

  useEffect(() => {
    if (!isPlacingPlace) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPlacingPlace(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlacingPlace, setIsPlacingPlace]);

  const handleStartEdit = (place: Place) => {
    if (mapCtx?.openEditPlaceModal) {
      mapCtx.openEditPlaceModal(place);
    } else if (mapCtx?.openEditLandmarkModal) {
      mapCtx.openEditLandmarkModal(place);
    } else {
      setLocalEditingPlace(place);
      setLocalModalOpen(true);
    }
  };

  const displayedPlaces = useMemo(() => {
    const filtered = filterLandmarks(places, {
      category: selectedCategoryFilter,
      search: searchQuery,
    });
    return sortLandmarks(filtered, sortBy);
  }, [places, selectedCategoryFilter, searchQuery, sortBy]);

  return (
    <div className="ciclista-places-panel ciclista-landmark-panel" aria-label="Places Management">
      <div className="ciclista-places-header ciclista-landmark-header">
        <p className="ciclista-places-subtitle ciclista-landmark-subtitle">
          Define places and anchor points for precomputed routing.
        </p>
        <button
          type="button"
          className="ciclista-btn ciclista-btn--primary ciclista-places-add-btn ciclista-landmark-add-btn"
          onClick={handleStartAddPlace}
        >
          <Plus size={16} /> Add Place
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="ciclista-card ciclista-places-controls-card ciclista-landmark-controls-card">
        <div className="ciclista-places-search-bar ciclista-landmark-search-bar">
          <Search size={16} className="ciclista-places-search-icon ciclista-landmark-search-icon" />
          <input
            type="text"
            className="ciclista-input ciclista-places-search-input ciclista-landmark-search-input"
            placeholder="Search places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search places"
          />
        </div>

        <div className="ciclista-places-filters-row ciclista-landmark-filters-row">
          <div className="ciclista-form-group ciclista-places-filter-group ciclista-landmark-filter-group">
            <label htmlFor="ciclista-places-filter-category" className="ciclista-label">
              Filter by Category
            </label>
            <select
              id="ciclista-places-filter-category"
              className="ciclista-select"
              value={selectedCategoryFilter}
              onChange={(e) =>
                setSelectedCategoryFilter(e.target.value as LandmarkCategory | 'all')
              }
            >
              <option value="all">All Categories</option>
              {LANDMARK_CATEGORIES.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ciclista-form-group ciclista-places-filter-group ciclista-landmark-filter-group">
            <label htmlFor="ciclista-places-sort-select" className="ciclista-label">
              Sort By
            </label>
            <select
              id="ciclista-places-sort-select"
              className="ciclista-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'createdAt' | 'category')}
            >
              <option value="name">Name</option>
              <option value="createdAt">Date Created</option>
              <option value="category">Category</option>
            </select>
          </div>
        </div>
      </div>

      {/* Places List */}
      <div className="ciclista-card ciclista-places-list-card ciclista-landmark-list-card">
        <div className="ciclista-places-list-header ciclista-landmark-list-header">
          <h3 className="ciclista-card-title">Saved Places</h3>
          <span className="ciclista-badge">{displayedPlaces.length}</span>
        </div>

        {displayedPlaces.length === 0 ? (
          <p className="ciclista-places-empty ciclista-landmark-empty">
            {places.length === 0
              ? 'No places configured yet. Add your home, office, doctor, or regular destinations above.'
              : 'No places match the current search or filter.'}
          </p>
        ) : (
          <ul className="ciclista-places-list ciclista-landmark-list">
            {displayedPlaces.map((place) => {
              const coord: Coordinate = { lat: place.lat, lng: place.lng };
              return (
                <li key={place.id} className="ciclista-places-item ciclista-landmark-item">
                  <div className="ciclista-places-item-header ciclista-landmark-item-header">
                    <div className="ciclista-places-item-title-group ciclista-landmark-item-title-group">
                      <span
                        className={`ciclista-places-category-badge ciclista-landmark-category-badge ciclista-landmark-badge--${place.category}`}
                        title={place.category}
                      >
                        {getCategoryIcon(place.category, 14)}
                        <span>{place.category}</span>
                      </span>
                      <strong className="ciclista-places-item-name ciclista-landmark-item-name">
                        {place.name}
                      </strong>
                    </div>

                    <div className="ciclista-places-item-actions ciclista-landmark-item-actions">
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary ciclista-places-action-btn ciclista-landmark-action-btn"
                        onClick={() => handleStartEdit(place)}
                        aria-label={`Edit ${place.name}`}
                        title="Edit place"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--danger ciclista-places-action-btn ciclista-landmark-action-btn"
                        onClick={() => handleDelete(place.id)}
                        aria-label={`Delete ${place.name}`}
                        title="Delete place"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {place.description && (
                    <p className="ciclista-places-item-desc ciclista-landmark-item-desc">
                      {place.description}
                    </p>
                  )}

                  <div className="ciclista-places-item-meta ciclista-landmark-item-meta">
                    <span className="ciclista-places-item-coords ciclista-landmark-item-coords">
                      {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                    </span>
                  </div>

                  {/* Routing Quick Action Buttons */}
                  <div className="ciclista-places-routing-actions ciclista-landmark-routing-actions">
                    {onSetStartCoord && (
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary ciclista-places-route-btn ciclista-landmark-route-btn"
                        onClick={() => onSetStartCoord(coord)}
                        title="Set as route origin"
                      >
                        Set Start
                      </button>
                    )}
                    {onSetEndCoord && (
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary ciclista-places-route-btn ciclista-landmark-route-btn"
                        onClick={() => onSetEndCoord(coord)}
                        title="Set as route destination"
                      >
                        Set Dest
                      </button>
                    )}
                    {onCenterMap && (
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary ciclista-places-route-btn ciclista-landmark-route-btn"
                        onClick={() => onCenterMap(coord)}
                        title="Center map on this place"
                      >
                        View
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Standalone fallback modal when MapContext is not mounted (e.g. unit tests) */}
      {!mapCtx && (
        <PlaceModal
          isOpen={localModalOpen}
          place={localEditingPlace}
          initialCoordinates={currentMapCenter ?? startCoord ?? endCoord ?? null}
          onClose={() => {
            setLocalModalOpen(false);
            setLocalEditingPlace(null);
          }}
          onCreatePlace={handleCreate}
          onUpdatePlace={handleUpdate}
          currentMapCenter={currentMapCenter}
          startCoord={startCoord}
          endCoord={endCoord}
        />
      )}

      {/* Persistent toast notifying user to pick a location on the map */}
      {isPlacingPlace && (
        <Toast
          message="Click on the map to set place location"
          icon={<MapPin size={16} />}
          position="bottom-right"
          persistent
          onClose={() => setIsPlacingPlace(false)}
        />
      )}
    </div>
  );
};

export { PlacesPanel as LandmarksPanel };
