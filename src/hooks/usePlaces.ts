import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createLandmark as createLandmarkDomain,
  deleteLandmark as deleteLandmarkDomain,
  updateLandmark as updateLandmarkDomain,
} from '../core/landmarks/landmarks';
import type { CreateLandmarkInput, Landmark, UpdateLandmarkInput } from '../core/landmarks/types';
import { LocalStorageProvider } from '../core/storage/storage';

const storage = new LocalStorageProvider();

/**
 * Type alias for user-defined geographic places and bookmarks.
 */
export type Place = Landmark;

/**
 * Input structure for creating a new place.
 */
export type CreatePlaceInput = CreateLandmarkInput;

/**
 * Input structure for updating an existing place.
 */
export type UpdatePlaceInput = UpdateLandmarkInput;

/**
 * Result interface exposed by the usePlaces hook.
 */
export interface UsePlacesResult {
  /**
   * List of all active user places.
   */
  places: Place[];
  /**
   * Alias for backward compatibility with landmarks interface.
   */
  landmarks: Place[];
  /**
   * Adds a new place and persists changes to storage.
   */
  addPlace: (input: CreatePlaceInput) => Place;
  /**
   * Alias for addPlace.
   */
  addLandmark: (input: CreateLandmarkInput) => Place;
  /**
   * Modifies an existing place and persists changes to storage.
   */
  updatePlace: (id: string, updates: UpdatePlaceInput) => Place | null;
  /**
   * Alias for updatePlace.
   */
  updateLandmark: (id: string, updates: UpdateLandmarkInput) => Place | null;
  /**
   * Deletes a place by ID and persists changes to storage.
   */
  deletePlace: (id: string) => void;
  /**
   * Alias for deletePlace.
   */
  deleteLandmark: (id: string) => void;
  /**
   * Clears all places from state and storage.
   */
  clearPlaces: () => void;
  /**
   * Alias for clearPlaces.
   */
  clearLandmarks: () => void;
  /**
   * Direct state dispatcher for places collection.
   */
  setPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  /**
   * Direct state dispatcher alias for places collection.
   */
  setLandmarks: React.Dispatch<React.SetStateAction<Place[]>>;
}

/**
 * React hook coordinating persistent storage, creation, modification,
 * and deletion of favorite places (ALT POIs).
 *
 * @returns Places state and CRUD action dispatchers.
 */
export function usePlaces(): UsePlacesResult {
  const [places, setPlaces] = useState<Place[]>(() => {
    return storage.loadLandmarksSync();
  });

  const isInitialMount = useRef(true);

  // Synchronize with storage on change (skipping initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    void storage.saveLandmarks(places);
  }, [places]);

  const addPlace = useCallback((input: CreatePlaceInput): Place => {
    const created = createLandmarkDomain(input);
    setPlaces((prev) => [created, ...prev]);
    return created;
  }, []);

  const updatePlace = useCallback((id: string, updates: UpdatePlaceInput): Place | null => {
    let updatedEntity: Place | null = null;
    setPlaces((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          updatedEntity = updateLandmarkDomain(item, updates);
          return updatedEntity;
        }
        return item;
      }),
    );
    return updatedEntity;
  }, []);

  const deletePlace = useCallback((id: string): void => {
    setPlaces((prev) => deleteLandmarkDomain(prev, id));
  }, []);

  const clearPlaces = useCallback((): void => {
    setPlaces([]);
  }, []);

  return {
    places,
    landmarks: places,
    addPlace,
    addLandmark: addPlace,
    updatePlace,
    updateLandmark: updatePlace,
    deletePlace,
    deleteLandmark: deletePlace,
    clearPlaces,
    clearLandmarks: clearPlaces,
    setPlaces,
    setLandmarks: setPlaces,
  };
}
