import {
  Briefcase,
  Crosshair,
  Edit2,
  GraduationCap,
  Home,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Stethoscope,
  Train,
  Trash2,
  Trees,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { Coordinate } from '../core/common/types';
import {
  filterLandmarks,
  LANDMARK_CATEGORIES,
  sortLandmarks,
  validateLandmarkInput,
} from '../core/landmarks/landmarks';
import type {
  CreateLandmarkInput,
  Landmark,
  LandmarkCategory,
  UpdateLandmarkInput,
} from '../core/landmarks/types';

/**
 * Returns a corresponding icon component for each landmark category.
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
      return <Star size={size} />;
  }
}

/**
 * Properties for the LandmarksPanel component.
 */
export interface LandmarksPanelProps {
  /**
   * Existing registered favorite places and landmarks.
   */
  landmarks: Landmark[];
  /**
   * Callback fired to add a new landmark.
   */
  onCreateLandmark: (input: CreateLandmarkInput) => void;
  /**
   * Callback fired to modify an existing landmark.
   */
  onUpdateLandmark: (id: string, updates: UpdateLandmarkInput) => void;
  /**
   * Callback fired to delete a landmark.
   */
  onDeleteLandmark: (id: string) => void;
  /**
   * Optional callback to set origin (start) routing marker to landmark coordinates.
   */
  onSetStartCoord?: (coord: Coordinate) => void;
  /**
   * Optional callback to set destination (end) routing marker to landmark coordinates.
   */
  onSetEndCoord?: (coord: Coordinate) => void;
  /**
   * Optional callback to center the map on the selected landmark coordinates.
   */
  onCenterMap?: (coord: Coordinate) => void;
  /**
   * Optional current map center coordinates for quick form prefilling.
   */
  currentMapCenter?: Coordinate | null;
  /**
   * Optional active start point coordinates for quick form prefilling.
   */
  startCoord?: Coordinate | null;
  /**
   * Optional active destination coordinates for quick form prefilling.
   */
  endCoord?: Coordinate | null;
}

/**
 * Sidebar panel allowing users to define, view, manage, and utilize favorite places
 * (Landmarks / ALT POIs) for routing and spatial bookmarks.
 */
export const LandmarksPanel: React.FC<LandmarksPanelProps> = ({
  landmarks,
  onCreateLandmark,
  onUpdateLandmark,
  onDeleteLandmark,
  onSetStartCoord,
  onSetEndCoord,
  onCenterMap,
  currentMapCenter,
  startCoord,
  endCoord,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<LandmarkCategory>('home');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<LandmarkCategory | 'all'>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'category'>('name');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCategory('home');
    setLat('');
    setLng('');
    setDescription('');
    setErrorMessage(null);
  };

  const handleStartEdit = (landmark: Landmark) => {
    setEditingId(landmark.id);
    setName(landmark.name);
    setCategory(landmark.category);
    setLat(landmark.lat.toString());
    setLng(landmark.lng.toString());
    setDescription(landmark.description ?? '');
    setErrorMessage(null);
  };

  const handlePrefillCoordinates = (coord: Coordinate | null | undefined) => {
    if (!coord) return;
    setLat(coord.lat.toFixed(6));
    setLng(coord.lng.toFixed(6));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    const inputCandidate = {
      name: name.trim(),
      category,
      lat: latNum,
      lng: lngNum,
      description: description.trim() || undefined,
    };

    const validation = validateLandmarkInput(inputCandidate);
    if (!validation.valid) {
      setErrorMessage(validation.errors[0] ?? 'Invalid landmark parameters');
      return;
    }

    if (editingId) {
      onUpdateLandmark(editingId, inputCandidate);
    } else {
      onCreateLandmark(inputCandidate);
    }

    resetForm();
  };

  const displayedLandmarks = useMemo(() => {
    const filtered = filterLandmarks(landmarks, {
      category: selectedCategoryFilter,
      search: searchQuery,
    });
    return sortLandmarks(filtered, sortBy);
  }, [landmarks, selectedCategoryFilter, searchQuery, sortBy]);

  return (
    <div className="ciclista-landmark-panel" aria-label="Favorites Management">
      <div className="ciclista-landmark-header">
        <p className="ciclista-landmark-subtitle">
          Define favorite destinations and anchor points for precomputed routing.
        </p>
      </div>

      {/* Create / Edit Form Card */}
      <form onSubmit={handleSubmit} className="ciclista-card ciclista-landmark-form">
        <div className="ciclista-landmark-form-header">
          <span className="ciclista-card-title">
            {editingId ? 'Edit Favorite Place' : 'Add New Favorite Place'}
          </span>
          {editingId && (
            <button
              type="button"
              className="ciclista-btn ciclista-btn--secondary ciclista-landmark-cancel-btn"
              onClick={resetForm}
              title="Cancel Edit"
            >
              <X size={14} /> Cancel
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="ciclista-landmark-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="ciclista-form-group">
          <label htmlFor="ciclista-landmark-name-input" className="ciclista-label">
            Name
          </label>
          <input
            id="ciclista-landmark-name-input"
            type="text"
            className="ciclista-input"
            placeholder="e.g. Home, Office, Dr. Mueller"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="ciclista-form-group">
          <label htmlFor="ciclista-landmark-category-select" className="ciclista-label">
            Category
          </label>
          <select
            id="ciclista-landmark-category-select"
            className="ciclista-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as LandmarkCategory)}
          >
            {LANDMARK_CATEGORIES.map((cat) => (
              <option key={cat.category} value={cat.category}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ciclista-landmark-coords-grid">
          <div className="ciclista-form-group">
            <label htmlFor="ciclista-landmark-lat-input" className="ciclista-label">
              Latitude
            </label>
            <input
              id="ciclista-landmark-lat-input"
              type="number"
              step="any"
              className="ciclista-input"
              placeholder="48.1370"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </div>

          <div className="ciclista-form-group">
            <label htmlFor="ciclista-landmark-lng-input" className="ciclista-label">
              Longitude
            </label>
            <input
              id="ciclista-landmark-lng-input"
              type="number"
              step="any"
              className="ciclista-input"
              placeholder="11.5750"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Coordinate Prefill Buttons */}
        <div className="ciclista-landmark-prefill-group">
          <span className="ciclista-landmark-prefill-label">Use Point:</span>
          {currentMapCenter && (
            <button
              type="button"
              className="ciclista-btn ciclista-btn--secondary ciclista-landmark-prefill-btn"
              onClick={() => handlePrefillCoordinates(currentMapCenter)}
              title="Use current map center coordinates"
            >
              <Crosshair size={12} /> Map Center
            </button>
          )}
          {startCoord && (
            <button
              type="button"
              className="ciclista-btn ciclista-btn--secondary ciclista-landmark-prefill-btn"
              onClick={() => handlePrefillCoordinates(startCoord)}
              title="Use active Start pin coordinates"
            >
              <MapPin size={12} /> Start Pin
            </button>
          )}
          {endCoord && (
            <button
              type="button"
              className="ciclista-btn ciclista-btn--secondary ciclista-landmark-prefill-btn"
              onClick={() => handlePrefillCoordinates(endCoord)}
              title="Use active Destination pin coordinates"
            >
              <MapPin size={12} /> Destination Pin
            </button>
          )}
        </div>

        <div className="ciclista-form-group">
          <label htmlFor="ciclista-landmark-description-input" className="ciclista-label">
            Notes / Description (Optional)
          </label>
          <input
            id="ciclista-landmark-description-input"
            type="text"
            className="ciclista-input"
            placeholder="Building entrance, bike parking info..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button type="submit" className="ciclista-btn ciclista-btn--primary">
          {editingId ? (
            <>
              <Edit2 size={16} /> Save Changes
            </>
          ) : (
            <>
              <Plus size={16} /> Add Favorite Place
            </>
          )}
        </button>
      </form>

      {/* Filter and Search Controls */}
      <div className="ciclista-card ciclista-landmark-controls-card">
        <div className="ciclista-landmark-search-bar">
          <Search size={16} className="ciclista-landmark-search-icon" />
          <input
            type="text"
            className="ciclista-input ciclista-landmark-search-input"
            placeholder="Search favorites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search landmarks"
          />
        </div>

        <div className="ciclista-landmark-filters-row">
          <div className="ciclista-form-group ciclista-landmark-filter-group">
            <label htmlFor="ciclista-landmark-filter-category" className="ciclista-label">
              Filter by Category
            </label>
            <select
              id="ciclista-landmark-filter-category"
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

          <div className="ciclista-form-group ciclista-landmark-filter-group">
            <label htmlFor="ciclista-landmark-sort-select" className="ciclista-label">
              Sort By
            </label>
            <select
              id="ciclista-landmark-sort-select"
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

      {/* Landmarks List */}
      <div className="ciclista-card ciclista-landmark-list-card">
        <div className="ciclista-landmark-list-header">
          <h3 className="ciclista-card-title">Saved Places</h3>
          <span className="ciclista-badge">{displayedLandmarks.length}</span>
        </div>

        {displayedLandmarks.length === 0 ? (
          <p className="ciclista-landmark-empty">
            {landmarks.length === 0
              ? 'No favorite places configured yet. Add your home, office, doctor, or regular destinations above.'
              : 'No places match the current search or filter.'}
          </p>
        ) : (
          <ul className="ciclista-landmark-list">
            {displayedLandmarks.map((landmark) => {
              const coord: Coordinate = { lat: landmark.lat, lng: landmark.lng };
              return (
                <li key={landmark.id} className="ciclista-landmark-item">
                  <div className="ciclista-landmark-item-header">
                    <div className="ciclista-landmark-item-title-group">
                      <span
                        className={`ciclista-landmark-category-badge ciclista-landmark-badge--${landmark.category}`}
                        title={landmark.category}
                      >
                        {getCategoryIcon(landmark.category, 14)}
                        <span>{landmark.category}</span>
                      </span>
                      <strong className="ciclista-landmark-item-name">{landmark.name}</strong>
                    </div>

                    <div className="ciclista-landmark-item-actions">
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary ciclista-landmark-action-btn"
                        onClick={() => handleStartEdit(landmark)}
                        aria-label={`Edit ${landmark.name}`}
                        title="Edit landmark"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--danger ciclista-landmark-action-btn"
                        onClick={() => onDeleteLandmark(landmark.id)}
                        aria-label={`Delete ${landmark.name}`}
                        title="Delete landmark"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {landmark.description && (
                    <p className="ciclista-landmark-item-desc">{landmark.description}</p>
                  )}

                  <div className="ciclista-landmark-item-meta">
                    <span className="ciclista-landmark-item-coords">
                      {landmark.lat.toFixed(4)}, {landmark.lng.toFixed(4)}
                    </span>
                  </div>

                  {/* Routing Quick Action Buttons */}
                  <div className="ciclista-landmark-routing-actions">
                    {onSetStartCoord && (
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary ciclista-landmark-route-btn"
                        onClick={() => onSetStartCoord(coord)}
                        title="Set as route origin"
                      >
                        Set Start
                      </button>
                    )}
                    {onSetEndCoord && (
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary ciclista-landmark-route-btn"
                        onClick={() => onSetEndCoord(coord)}
                        title="Set as route destination"
                      >
                        Set Dest
                      </button>
                    )}
                    {onCenterMap && (
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary ciclista-landmark-route-btn"
                        onClick={() => onCenterMap(coord)}
                        title="Center map on this landmark"
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
    </div>
  );
};
