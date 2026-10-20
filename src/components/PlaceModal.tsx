import React from 'react';

import type { Coordinate } from '../core/common/types';
import type { CreatePlaceInput, Place, UpdatePlaceInput } from '../hooks/usePlaces';
import { Modal } from './Modal';
import {
  CategorySelectDropdown,
  type CategorySelectDropdownProps,
  PLACE_CATEGORIES,
  type PlaceCategory,
  type PlaceCategoryOption,
  PlaceForm,
  type PlaceFormProps,
} from './places';

export type { CategorySelectDropdownProps, PlaceCategory, PlaceCategoryOption, PlaceFormProps };
export { CategorySelectDropdown, PLACE_CATEGORIES, PlaceForm };

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
   * @deprecated Use `place` instead.
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
   * @deprecated Use `onCreatePlace` instead.
   */
  onCreateLandmark?: (input: CreatePlaceInput) => void;
  /**
   * Callback fired when updating an existing place.
   */
  onUpdatePlace?: (id: string, updates: UpdatePlaceInput) => void;
  /**
   * Alias for onUpdatePlace.
   * @deprecated Use `onUpdatePlace` instead.
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
      <PlaceForm
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
