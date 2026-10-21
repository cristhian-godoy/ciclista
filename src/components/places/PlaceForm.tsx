import React, { useState } from 'react';

import type { Coordinate } from '../../core/common/types';
import { validateLandmarkInput } from '../../core/landmarks/landmarks';
import type { LandmarkCategory } from '../../core/landmarks/types';
import type { CreatePlaceInput, Place, UpdatePlaceInput } from '../../hooks/usePlaces';
import { Edit2, Plus, X } from '../common/Icon';
import { CategorySelectDropdown } from './CategorySelectDropdown';
import { CATEGORY_MAP, type PlaceCategory } from './types';

/**
 * Properties for PlaceForm component.
 */
export interface PlaceFormProps {
  place?: Place | null;
  initialCoordinates?: Coordinate | null;
  onClose: () => void;
  onCreatePlace?: (input: CreatePlaceInput) => void;
  onUpdatePlace?: (id: string, updates: UpdatePlaceInput) => void;
  currentMapCenter?: Coordinate | null;
  startCoord?: Coordinate | null;
  endCoord?: Coordinate | null;
}

/**
 * Normalizes any category string into a supported PlaceCategory or empty string placeholder.
 */
function normalizeCategory(category?: string): PlaceCategory | '' {
  if (
    category === 'home' ||
    category === 'work' ||
    category === 'doctor' ||
    category === 'school' ||
    category === 'other'
  ) {
    return category;
  }
  return '';
}

/**
 * Modular form component for creating or editing user places.
 */
export const PlaceForm: React.FC<PlaceFormProps> = ({
  place,
  initialCoordinates,
  onClose,
  onCreatePlace,
  onUpdatePlace,
  currentMapCenter,
  startCoord,
  endCoord,
}) => {
  const [category, setCategory] = useState<PlaceCategory | ''>(() =>
    place ? normalizeCategory(place.category) : '',
  );
  const [name, setName] = useState(place ? place.name : '');
  const [description, setDescription] = useState(place?.description ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectCategory = (newCategory: PlaceCategory) => {
    setCategory(newCategory);
    const matched = CATEGORY_MAP.get(newCategory);
    if (matched) {
      setName(matched.defaultName);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!category) {
      setErrorMessage('Please select a category.');
      return;
    }

    const targetLat =
      place?.lat ??
      initialCoordinates?.lat ??
      currentMapCenter?.lat ??
      startCoord?.lat ??
      endCoord?.lat ??
      0;
    const targetLng =
      place?.lng ??
      initialCoordinates?.lng ??
      currentMapCenter?.lng ??
      startCoord?.lng ??
      endCoord?.lng ??
      0;

    const inputCandidate: CreatePlaceInput = {
      name: name.trim(),
      category: category as LandmarkCategory,
      lat: targetLat,
      lng: targetLng,
      description: description.trim() || undefined,
    };

    const validation = validateLandmarkInput(inputCandidate);
    if (!validation.valid) {
      setErrorMessage(validation.errors[0] ?? 'Invalid place parameters');
      return;
    }

    if (place) {
      onUpdatePlace?.(place.id, inputCandidate);
    } else {
      onCreatePlace?.(inputCandidate);
    }

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="ciclista-place-form">
      {errorMessage && (
        <div className="ciclista-place-error" role="alert">
          {errorMessage}
        </div>
      )}

      {/* 1. Type / Category selector comes FIRST */}
      <div className="ciclista-form-group ciclista-category-selector-group">
        <label
          id="ciclista-place-category-label"
          htmlFor="ciclista-place-category-trigger"
          className="ciclista-label"
        >
          Category
        </label>
        <CategorySelectDropdown
          category={category}
          onSelectCategory={handleSelectCategory}
          labelId="ciclista-place-category-label"
          triggerId="ciclista-place-category-trigger"
        />
      </div>

      {/* 2. Name input comes AFTER */}
      <div className="ciclista-form-group">
        <label htmlFor="ciclista-place-name-input" className="ciclista-label">
          Name
        </label>
        <input
          id="ciclista-place-name-input"
          type="text"
          className="ciclista-input"
          placeholder="e.g. Home, Office, Dr. Mueller"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* 3. Notes / description (optional) after */}
      <div className="ciclista-form-group">
        <label htmlFor="ciclista-place-description-input" className="ciclista-label">
          Notes / Description (Optional)
        </label>
        <input
          id="ciclista-place-description-input"
          type="text"
          className="ciclista-input"
          placeholder="Building entrance, bike parking info..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="ciclista-place-form-actions">
        <button
          type="button"
          className="ciclista-btn ciclista-btn--secondary ciclista-place-cancel-btn"
          onClick={onClose}
          title="Cancel"
        >
          <X size={14} /> Cancel
        </button>
        <button type="submit" className="ciclista-btn ciclista-btn--primary">
          {place ? (
            <>
              <Edit2 size={16} /> Save Changes
            </>
          ) : (
            <>
              <Plus size={16} /> Add Place
            </>
          )}
        </button>
      </div>
    </form>
  );
};
