/**
 * Predefined semantic categories for favorite places and points of interest.
 */
export type LandmarkCategory =
  | 'home'
  | 'work'
  | 'doctor'
  | 'school'
  | 'shop'
  | 'transit'
  | 'leisure'
  | 'other';

/**
 * Domain entity representing a user-defined landmark, favorite destination, or ALT preprocessing anchor.
 */
export interface Landmark {
  /**
   * Unique identifier of the landmark.
   */
  id: string;
  /**
   * Human-readable label or title of the place.
   */
  name: string;
  /**
   * Category classification for filtering, iconography, and semantic grouping.
   */
  category: LandmarkCategory;
  /**
   * Latitude in decimal degrees (-90 to 90).
   */
  lat: number;
  /**
   * Longitude in decimal degrees (-180 to 180).
   */
  lng: number;
  /**
   * Optional descriptive context, instructions, or notes.
   */
  description?: string;
  /**
   * Millisecond timestamp recording when this landmark was created.
   */
  createdAt: number;
  /**
   * Millisecond timestamp recording when this landmark was last updated.
   */
  updatedAt: number;
}

/**
 * Input parameters required to register a new landmark.
 */
export interface CreateLandmarkInput {
  name: string;
  category: LandmarkCategory;
  lat: number;
  lng: number;
  description?: string;
}

/**
 * Input parameters for modifying an existing landmark.
 */
export interface UpdateLandmarkInput {
  name?: string;
  category?: LandmarkCategory;
  lat?: number;
  lng?: number;
  description?: string;
}

/**
 * Result returned by validation functions verifying landmark inputs.
 */
export interface LandmarkValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Metadata descriptor for landmark categories used in UI selections and presentation.
 */
export interface CategoryDescriptor {
  category: LandmarkCategory;
  label: string;
  defaultName: string;
}
