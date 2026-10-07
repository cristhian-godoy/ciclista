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
 * Result interface exposed by the useLandmarks hook.
 */
export interface UseLandmarksResult {
  /**
   * List of all active user landmarks.
   */
  landmarks: Landmark[];
  /**
   * Adds a new landmark and persists changes to storage.
   */
  addLandmark: (input: CreateLandmarkInput) => Landmark;
  /**
   * Modifies an existing landmark and persists changes to storage.
   */
  updateLandmark: (id: string, updates: UpdateLandmarkInput) => Landmark | null;
  /**
   * Deletes a landmark by ID and persists changes to storage.
   */
  deleteLandmark: (id: string) => void;
  /**
   * Clears all landmarks from state and storage.
   */
  clearLandmarks: () => void;
  /**
   * Direct state dispatcher for landmarks collection.
   */
  setLandmarks: React.Dispatch<React.SetStateAction<Landmark[]>>;
}

/**
 * React hook coordinating persistent storage, creation, modification,
 * and deletion of favorite places / landmarks (ALT POIs).
 *
 * @returns Landmark state and CRUD action dispatchers.
 */
export function useLandmarks(): UseLandmarksResult {
  const [landmarks, setLandmarks] = useState<Landmark[]>(() => {
    return storage.loadLandmarksSync();
  });

  const isInitialMount = useRef(true);

  // Synchronize with storage on change (skipping initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    void storage.saveLandmarks(landmarks);
  }, [landmarks]);

  const addLandmark = useCallback((input: CreateLandmarkInput): Landmark => {
    const created = createLandmarkDomain(input);
    setLandmarks((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateLandmark = useCallback(
    (id: string, updates: UpdateLandmarkInput): Landmark | null => {
      let updatedEntity: Landmark | null = null;
      setLandmarks((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            updatedEntity = updateLandmarkDomain(item, updates);
            return updatedEntity;
          }
          return item;
        }),
      );
      return updatedEntity;
    },
    [],
  );

  const deleteLandmark = useCallback((id: string): void => {
    setLandmarks((prev) => deleteLandmarkDomain(prev, id));
  }, []);

  const clearLandmarks = useCallback((): void => {
    setLandmarks([]);
  }, []);

  return {
    landmarks,
    addLandmark,
    updateLandmark,
    deleteLandmark,
    clearLandmarks,
    setLandmarks,
  };
}
