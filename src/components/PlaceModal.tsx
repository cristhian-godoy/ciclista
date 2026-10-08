import {
  Briefcase,
  Check,
  ChevronDown,
  Edit2,
  GraduationCap,
  Home,
  MapPin,
  Plus,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { Coordinate } from '../core/common/types';
import { validateLandmarkInput } from '../core/landmarks/landmarks';
import type { LandmarkCategory } from '../core/landmarks/types';
import type { CreatePlaceInput, Place, UpdatePlaceInput } from '../hooks/usePlaces';
import { Modal } from './Modal';

/**
 * Supported strict categories for places.
 */
export type PlaceCategory = 'home' | 'work' | 'doctor' | 'school' | 'other';

/**
 * Category metadata descriptor for searchable dropdown.
 */
export interface PlaceCategoryOption {
  category: PlaceCategory;
  label: string;
  defaultName: string;
  icon: React.ReactNode;
}

/**
 * Strictly supported categories with corresponding icons and prefill names.
 */
const PLACE_CATEGORIES: readonly PlaceCategoryOption[] = [
  { category: 'home', label: 'Home', defaultName: 'Home', icon: <Home size={16} /> },
  { category: 'work', label: 'Work', defaultName: 'Work', icon: <Briefcase size={16} /> },
  { category: 'doctor', label: 'Doctor', defaultName: 'Doctor', icon: <Stethoscope size={16} /> },
  { category: 'school', label: 'School', defaultName: 'School', icon: <GraduationCap size={16} /> },
  { category: 'other', label: 'Other', defaultName: 'Other', icon: <MapPin size={16} /> },
] as const;

const CATEGORY_MAP = new Map<PlaceCategory, PlaceCategoryOption>(
  PLACE_CATEGORIES.map((opt) => [opt.category, opt]),
);

/**
 * Properties for the PlaceModal dialog component.
 */
export interface PlaceModalProps {
  /**
   * Whether the modal dialog is currently visible.
   */
  isOpen: boolean;
  /**
   * Place entity being edited (if in edit mode).
   */
  place?: Place | null;
  /**
   * Alias for place entity (for backward compatibility).
   */
  landmark?: Place | null;
  /**
   * Initial spatial coordinates for new place creation.
   */
  initialCoordinates?: Coordinate | null;
  /**
   * Callback fired when closing the modal dialog.
   */
  onClose: () => void;
  /**
   * Callback fired when creating a new place.
   */
  onCreatePlace?: (input: CreatePlaceInput) => void;
  /**
   * Alias for onCreatePlace.
   */
  onCreateLandmark?: (input: CreatePlaceInput) => void;
  /**
   * Callback fired when updating an existing place.
   */
  onUpdatePlace?: (id: string, updates: UpdatePlaceInput) => void;
  /**
   * Alias for onUpdatePlace.
   */
  onUpdateLandmark?: (id: string, updates: UpdatePlaceInput) => void;
  /**
   * Optional map center coordinates for fallback position.
   */
  currentMapCenter?: Coordinate | null;
  /**
   * Optional active start pin coordinates for fallback position.
   */
  startCoord?: Coordinate | null;
  /**
   * Optional active destination coordinates for fallback position.
   */
  endCoord?: Coordinate | null;
}

interface PlaceFormContentProps {
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
 * Normalizes any category string into a supported PlaceCategory.
 */
function normalizeCategory(category?: string): PlaceCategory {
  if (
    category === 'home' ||
    category === 'work' ||
    category === 'doctor' ||
    category === 'school' ||
    category === 'other'
  ) {
    return category;
  }
  return category ? 'other' : 'home';
}

const PlaceFormContent: React.FC<PlaceFormContentProps> = ({
  place,
  initialCoordinates,
  onClose,
  onCreatePlace,
  onUpdatePlace,
  currentMapCenter,
  startCoord,
  endCoord,
}) => {
  const [category, setCategory] = useState<PlaceCategory>(() => normalizeCategory(place?.category));
  const [name, setName] = useState(place ? place.name : '');
  const [description, setDescription] = useState(place?.description ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Searchable dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredCategories = useMemo(() => {
    if (!searchFilter.trim()) {
      return PLACE_CATEGORIES;
    }
    const q = searchFilter.trim().toLowerCase();
    return PLACE_CATEGORIES.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [searchFilter]);

  const selectedCategoryOption = useMemo(() => {
    return (
      CATEGORY_MAP.get(category) ?? {
        category: 'other' as PlaceCategory,
        label: 'Other',
        defaultName: 'Other',
        icon: <MapPin size={16} />,
      }
    );
  }, [category]);

  // Handle outside click to close category dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      searchInputRef.current?.focus();
    }
  }, [isDropdownOpen]);

  const handleOpenDropdown = () => {
    setHighlightedIndex(0);
    setSearchFilter('');
    setIsDropdownOpen(true);
  };

  const handleSelectCategory = (newCategory: PlaceCategory) => {
    setCategory(newCategory);
    const matched = CATEGORY_MAP.get(newCategory);
    if (matched) {
      setName(matched.defaultName);
    }
    setIsDropdownOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenDropdown();
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < filteredCategories.length ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCategories[highlightedIndex];
      if (selected) {
        handleSelectCategory(selected.category);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsDropdownOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

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
    <form onSubmit={handleSubmit} className="ciclista-place-form ciclista-landmark-form">
      {errorMessage && (
        <div className="ciclista-place-error ciclista-landmark-error" role="alert">
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
        <div className="ciclista-searchable-dropdown" ref={dropdownRef}>
          <button
            ref={triggerRef}
            type="button"
            role="combobox"
            id="ciclista-place-category-trigger"
            className="ciclista-select ciclista-category-select-trigger"
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            aria-labelledby="ciclista-place-category-label ciclista-place-category-trigger"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            onKeyDown={handleTriggerKeyDown}
          >
            <span className="ciclista-category-trigger-content">
              {selectedCategoryOption.icon}
              <span>{selectedCategoryOption.label}</span>
            </span>
            <ChevronDown
              size={16}
              className={`ciclista-dropdown-chevron ${isDropdownOpen ? 'ciclista-dropdown-chevron--open' : ''}`}
            />
          </button>

          {isDropdownOpen && (
            <div
              className="ciclista-category-dropdown-menu"
              role="listbox"
              aria-labelledby="ciclista-place-category-label"
            >
              <div className="ciclista-category-dropdown-search">
                <Search size={14} className="ciclista-category-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="ciclista-input ciclista-category-search-input"
                  placeholder="Search category..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  aria-label="Search category"
                />
              </div>

              <ul className="ciclista-category-options-list">
                {filteredCategories.length === 0 ? (
                  <li className="ciclista-category-option-empty">No categories found</li>
                ) : (
                  filteredCategories.map((opt, index) => {
                    const isSelected = category === opt.category;
                    const isHighlighted = highlightedIndex === index;
                    return (
                      <li
                        key={opt.category}
                        role="option"
                        aria-selected={isSelected}
                        className={`ciclista-category-option ${isSelected ? 'selected' : ''} ${
                          isHighlighted ? 'ciclista-category-option--highlighted' : ''
                        }`}
                        onClick={() => handleSelectCategory(opt.category)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        <span className="ciclista-category-option-icon">{opt.icon}</span>
                        <span className="ciclista-category-option-label">{opt.label}</span>
                        {isSelected && (
                          <Check size={14} className="ciclista-category-option-check" />
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
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
          autoFocus={!isDropdownOpen}
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

      <div className="ciclista-place-form-actions ciclista-landmark-form-actions">
        <button
          type="button"
          className="ciclista-btn ciclista-btn--secondary ciclista-place-cancel-btn ciclista-landmark-cancel-btn"
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

/**
 * Modal dialog hosting the place form to create or edit favorite places with
 * a category-first searchable selector.
 */
export const PlaceModal: React.FC<PlaceModalProps> = ({
  isOpen,
  place,
  landmark,
  initialCoordinates,
  onClose,
  onCreatePlace,
  onCreateLandmark,
  onUpdatePlace,
  onUpdateLandmark,
  currentMapCenter,
  startCoord,
  endCoord,
}) => {
  if (!isOpen) return null;

  const targetEntity = place ?? landmark;
  const handleCreate = onCreatePlace ?? onCreateLandmark;
  const handleUpdate = onUpdatePlace ?? onUpdateLandmark;

  const formKey = targetEntity
    ? `edit-${targetEntity.id}`
    : `create-${initialCoordinates?.lat ?? ''}-${initialCoordinates?.lng ?? ''}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={targetEntity ? 'Edit Place' : 'Add New Place'}>
      <PlaceFormContent
        key={formKey}
        place={targetEntity}
        initialCoordinates={initialCoordinates}
        onClose={onClose}
        onCreatePlace={handleCreate}
        onUpdatePlace={handleUpdate}
        currentMapCenter={currentMapCenter}
        startCoord={startCoord}
        endCoord={endCoord}
      />
    </Modal>
  );
};

export { PlaceModal as LandmarkModal };
