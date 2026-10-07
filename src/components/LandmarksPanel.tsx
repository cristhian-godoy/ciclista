import {
  Briefcase,
  Edit2,
  GraduationCap,
  Home,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Stethoscope,
  Train,
  Trash2,
  Trees,
} from 'lucide-react';
import React, { useContext, useMemo, useState } from 'react';

import type { Coordinate } from '../core/common/types';
import { filterLandmarks, LANDMARK_CATEGORIES, sortLandmarks } from '../core/landmarks/landmarks';
import type {
  CreateLandmarkInput,
  Landmark,
  LandmarkCategory,
  UpdateLandmarkInput,
} from '../core/landmarks/types';
import { LandmarkModal } from './LandmarkModal';
import { MapContext } from './map/MapContext';

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
  const mapCtx = useContext(MapContext);

  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [localEditingLandmark, setLocalEditingLandmark] = useState<Landmark | null>(null);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<LandmarkCategory | 'all'>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'category'>('name');

  const handleOpenCreateModal = () => {
    if (mapCtx?.openCreateLandmarkModal) {
      mapCtx.openCreateLandmarkModal(currentMapCenter ?? startCoord ?? endCoord ?? null);
    } else {
      setLocalEditingLandmark(null);
      setLocalModalOpen(true);
    }
  };

  const handleStartEdit = (landmark: Landmark) => {
    if (mapCtx?.openEditLandmarkModal) {
      mapCtx.openEditLandmarkModal(landmark);
    } else {
      setLocalEditingLandmark(landmark);
      setLocalModalOpen(true);
    }
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
        <button
          type="button"
          className="ciclista-btn ciclista-btn--primary ciclista-landmark-add-btn"
          onClick={handleOpenCreateModal}
        >
          <Plus size={16} /> Add Favorite
        </button>
      </div>

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

      {/* Standalone fallback modal when MapContext is not mounted (e.g. unit tests) */}
      {!mapCtx && (
        <LandmarkModal
          isOpen={localModalOpen}
          landmark={localEditingLandmark}
          initialCoordinates={currentMapCenter ?? startCoord ?? endCoord ?? null}
          onClose={() => {
            setLocalModalOpen(false);
            setLocalEditingLandmark(null);
          }}
          onCreateLandmark={onCreateLandmark}
          onUpdateLandmark={onUpdateLandmark}
          currentMapCenter={currentMapCenter}
          startCoord={startCoord}
          endCoord={endCoord}
        />
      )}
    </div>
  );
};
