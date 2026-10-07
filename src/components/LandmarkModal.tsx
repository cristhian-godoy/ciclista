import { Crosshair, Edit2, MapPin, Plus, X } from 'lucide-react';
import React, { useState } from 'react';

import type { Coordinate } from '../core/common/types';
import { LANDMARK_CATEGORIES, validateLandmarkInput } from '../core/landmarks/landmarks';
import type {
  CreateLandmarkInput,
  Landmark,
  LandmarkCategory,
  UpdateLandmarkInput,
} from '../core/landmarks/types';
import { Modal } from './Modal';

/**
 * Properties for the LandmarkModal dialog component.
 */
export interface LandmarkModalProps {
  /**
   * Whether the modal dialog is currently visible.
   */
  isOpen: boolean;
  /**
   * Landmark being edited (if in edit mode).
   */
  landmark?: Landmark | null;
  /**
   * Initial spatial coordinates for new landmark creation.
   */
  initialCoordinates?: Coordinate | null;
  /**
   * Callback fired when closing the modal dialog.
   */
  onClose: () => void;
  /**
   * Callback fired when creating a new landmark.
   */
  onCreateLandmark?: (input: CreateLandmarkInput) => void;
  /**
   * Callback fired when updating an existing landmark.
   */
  onUpdateLandmark?: (id: string, updates: UpdateLandmarkInput) => void;
  /**
   * Optional map center coordinates for quick prefilling.
   */
  currentMapCenter?: Coordinate | null;
  /**
   * Optional active start pin coordinates for quick prefilling.
   */
  startCoord?: Coordinate | null;
  /**
   * Optional active destination coordinates for quick prefilling.
   */
  endCoord?: Coordinate | null;
}

interface LandmarkFormContentProps {
  landmark?: Landmark | null;
  initialCoordinates?: Coordinate | null;
  onClose: () => void;
  onCreateLandmark?: (input: CreateLandmarkInput) => void;
  onUpdateLandmark?: (id: string, updates: UpdateLandmarkInput) => void;
  currentMapCenter?: Coordinate | null;
  startCoord?: Coordinate | null;
  endCoord?: Coordinate | null;
}

const LandmarkFormContent: React.FC<LandmarkFormContentProps> = ({
  landmark,
  initialCoordinates,
  onClose,
  onCreateLandmark,
  onUpdateLandmark,
  currentMapCenter,
  startCoord,
  endCoord,
}) => {
  const [name, setName] = useState(landmark ? landmark.name : '');
  const [category, setCategory] = useState<LandmarkCategory>(landmark ? landmark.category : 'home');
  const [lat, setLat] = useState(
    landmark
      ? landmark.lat.toString()
      : initialCoordinates
        ? initialCoordinates.lat.toFixed(6)
        : '',
  );
  const [lng, setLng] = useState(
    landmark
      ? landmark.lng.toString()
      : initialCoordinates
        ? initialCoordinates.lng.toFixed(6)
        : '',
  );
  const [description, setDescription] = useState(landmark?.description ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    if (landmark) {
      onUpdateLandmark?.(landmark.id, inputCandidate);
    } else {
      onCreateLandmark?.(inputCandidate);
    }

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="ciclista-landmark-form">
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
          autoFocus
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

      <div className="ciclista-landmark-form-actions">
        <button
          type="button"
          className="ciclista-btn ciclista-btn--secondary ciclista-landmark-cancel-btn"
          onClick={onClose}
          title="Cancel"
        >
          <X size={14} /> Cancel
        </button>
        <button type="submit" className="ciclista-btn ciclista-btn--primary">
          {landmark ? (
            <>
              <Edit2 size={16} /> Save Changes
            </>
          ) : (
            <>
              <Plus size={16} /> Add Favorite Place
            </>
          )}
        </button>
      </div>
    </form>
  );
};

/**
 * Modal dialog hosting the landmark form to create or edit favorite places and POIs.
 */
export const LandmarkModal: React.FC<LandmarkModalProps> = ({
  isOpen,
  landmark,
  initialCoordinates,
  onClose,
  onCreateLandmark,
  onUpdateLandmark,
  currentMapCenter,
  startCoord,
  endCoord,
}) => {
  if (!isOpen) return null;

  const formKey = landmark
    ? `edit-${landmark.id}`
    : `create-${initialCoordinates?.lat ?? ''}-${initialCoordinates?.lng ?? ''}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={landmark ? 'Edit Favorite Place' : 'Add New Favorite Place'}
    >
      <LandmarkFormContent
        key={formKey}
        landmark={landmark}
        initialCoordinates={initialCoordinates}
        onClose={onClose}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        currentMapCenter={currentMapCenter}
        startCoord={startCoord}
        endCoord={endCoord}
      />
    </Modal>
  );
};
