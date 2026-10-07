import type {
  CategoryDescriptor,
  CreateLandmarkInput,
  Landmark,
  LandmarkCategory,
  LandmarkValidationResult,
  UpdateLandmarkInput,
} from './types';

/**
 * Metadata table detailing all supported landmark categories with display labels and defaults.
 */
export const LANDMARK_CATEGORIES: readonly CategoryDescriptor[] = [
  { category: 'home', label: 'Home', defaultName: 'Home' },
  { category: 'work', label: 'Work / Office', defaultName: 'Office' },
  { category: 'doctor', label: 'Doctor / Medical', defaultName: 'Doctor' },
  { category: 'school', label: 'School / University', defaultName: 'School' },
  { category: 'shop', label: 'Shopping / Grocery', defaultName: 'Market' },
  { category: 'transit', label: 'Transit / Station', defaultName: 'Station' },
  { category: 'leisure', label: 'Park / Leisure', defaultName: 'Park' },
  { category: 'other', label: 'Other', defaultName: 'Favorite' },
] as const;

const VALID_CATEGORIES = new Set<string>(LANDMARK_CATEGORIES.map((c) => c.category));

/**
 * Type guard checking whether a given value is a recognized LandmarkCategory.
 *
 * @param value - Candidate value to inspect.
 * @returns True if value is a valid LandmarkCategory.
 */
export function isValidCategory(value: unknown): value is LandmarkCategory {
  return typeof value === 'string' && VALID_CATEGORIES.has(value);
}

/**
 * Validates input parameters for creating or updating a landmark.
 *
 * @param input - Candidate landmark input values.
 * @returns Validation outcome containing boolean status and error messages if invalid.
 */
export function validateLandmarkInput(
  input: Partial<CreateLandmarkInput>,
): LandmarkValidationResult {
  const errors: string[] = [];

  if (input.name === undefined || input.name === null || input.name.trim().length === 0) {
    errors.push('Landmark name must not be empty.');
  } else if (input.name.trim().length > 100) {
    errors.push('Landmark name must not exceed 100 characters.');
  }

  if (input.category === undefined || !isValidCategory(input.category)) {
    errors.push('Invalid or missing landmark category.');
  }

  if (input.lat === undefined || typeof input.lat !== 'number' || !Number.isFinite(input.lat)) {
    errors.push('Latitude must be a valid finite number.');
  } else if (input.lat < -90 || input.lat > 90) {
    errors.push('Latitude must fall between -90 and 90 degrees.');
  }

  if (input.lng === undefined || typeof input.lng !== 'number' || !Number.isFinite(input.lng)) {
    errors.push('Longitude must be a valid finite number.');
  } else if (input.lng < -180 || input.lng > 180) {
    errors.push('Longitude must fall between -180 and 180 degrees.');
  }

  if (input.description !== undefined && input.description.length > 500) {
    errors.push('Description must not exceed 500 characters.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Instantiates and returns a new Landmark entity from valid input parameters.
 * Throws an Error if validation checks fail.
 *
 * @param input - Properties for the new landmark.
 * @returns Fully constructed Landmark object with generated identifier and timestamps.
 */
export function createLandmark(input: CreateLandmarkInput): Landmark {
  const validation = validateLandmarkInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid landmark input: ${validation.errors.join(' ')}`);
  }

  const now = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const id = `landmark-${now}-${randomSuffix}`;

  return {
    id,
    name: input.name.trim(),
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    description: input.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Produces an updated Landmark instance with modified fields and refreshed updatedAt timestamp.
 * Throws an Error if updated parameters fail validation.
 *
 * @param landmark - Existing landmark to update.
 * @param updates - Property modifications to apply.
 * @returns New Landmark object incorporating updates.
 */
export function updateLandmark(landmark: Landmark, updates: UpdateLandmarkInput): Landmark {
  const merged: CreateLandmarkInput = {
    name: updates.name !== undefined ? updates.name : landmark.name,
    category: updates.category !== undefined ? updates.category : landmark.category,
    lat: updates.lat !== undefined ? updates.lat : landmark.lat,
    lng: updates.lng !== undefined ? updates.lng : landmark.lng,
    description: updates.description !== undefined ? updates.description : landmark.description,
  };

  const validation = validateLandmarkInput(merged);
  if (!validation.valid) {
    throw new Error(`Invalid landmark update: ${validation.errors.join(' ')}`);
  }

  return {
    ...landmark,
    name: merged.name.trim(),
    category: merged.category,
    lat: merged.lat,
    lng: merged.lng,
    description: merged.description?.trim() || undefined,
    updatedAt: Date.now(),
  };
}

/**
 * Removes a landmark with the specified ID from an array of landmarks.
 *
 * @param landmarks - Collection of existing landmarks.
 * @param id - Identifier of the landmark to delete.
 * @returns Filtered array omitting the deleted landmark.
 */
export function deleteLandmark(landmarks: readonly Landmark[], id: string): Landmark[] {
  return landmarks.filter((l) => l.id !== id);
}

/**
 * Filters a collection of landmarks by category and optional text search query.
 *
 * @param landmarks - Collection of landmarks to filter.
 * @param options - Filtering constraints including category and text search query.
 * @returns Subset of landmarks meeting the specified criteria.
 */
export function filterLandmarks(
  landmarks: readonly Landmark[],
  options?: {
    category?: LandmarkCategory | 'all';
    search?: string;
  },
): Landmark[] {
  let result = [...landmarks];

  if (options?.category && options.category !== 'all') {
    result = result.filter((l) => l.category === options.category);
  }

  if (options?.search && options.search.trim().length > 0) {
    const q = options.search.trim().toLowerCase();
    result = result.filter(
      (l) =>
        l.name.toLowerCase().includes(q) || (l.description?.toLowerCase().includes(q) ?? false),
    );
  }

  return result;
}

/**
 * Sorts landmarks by name, creation date, or category.
 *
 * @param landmarks - Collection of landmarks to sort.
 * @param sortBy - Dimension along which to order items ('name' | 'createdAt' | 'category').
 * @returns Sorted copy of landmarks.
 */
export function sortLandmarks(
  landmarks: readonly Landmark[],
  sortBy: 'name' | 'createdAt' | 'category' = 'name',
): Landmark[] {
  return [...landmarks].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }
    if (sortBy === 'createdAt') {
      return b.createdAt - a.createdAt;
    }
    if (sortBy === 'category') {
      return a.category.localeCompare(b.category);
    }
    return 0;
  });
}

/**
 * Computes great-circle distance between two geographic coordinates in meters using the Haversine formula.
 *
 * @param coord1 - First coordinate { lat, lng }.
 * @param coord2 - Second coordinate { lat, lng }.
 * @returns Distance in meters.
 */
export function calculateHaversineDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number },
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

/**
 * Locates the landmark nearest to a given coordinate within a collection.
 *
 * @param landmarks - Collection of landmarks to examine.
 * @param target - Reference coordinate { lat, lng }.
 * @returns Object with nearest landmark and distance in meters, or null if collection is empty.
 */
export function findNearestLandmark(
  landmarks: readonly Landmark[],
  target: { lat: number; lng: number },
): { landmark: Landmark; distanceMeters: number } | null {
  if (landmarks.length === 0) {
    return null;
  }

  let nearest: Landmark | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const landmark of landmarks) {
    const dist = calculateHaversineDistance(landmark, target);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = landmark;
    }
  }

  return nearest ? { landmark: nearest, distanceMeters: minDistance } : null;
}

/**
 * Serializes a collection of landmarks to a JSON string.
 *
 * @param landmarks - Collection of landmarks to serialize.
 * @returns JSON string representation.
 */
export function serializeLandmarks(landmarks: readonly Landmark[]): string {
  return JSON.stringify(landmarks);
}

/**
 * Safely parses and validates a JSON string into an array of Landmark entities.
 * Discards malformed records gracefully and returns an empty array on parse errors.
 *
 * @param raw - Candidate JSON string.
 * @returns Array of validated Landmark instances.
 */
export function deserializeLandmarks(raw: string): Landmark[] {
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const validated: Landmark[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        isValidCategory(item.category) &&
        typeof item.lat === 'number' &&
        Number.isFinite(item.lat) &&
        typeof item.lng === 'number' &&
        Number.isFinite(item.lng) &&
        typeof item.createdAt === 'number' &&
        typeof item.updatedAt === 'number'
      ) {
        validated.push({
          id: item.id,
          name: item.name,
          category: item.category,
          lat: item.lat,
          lng: item.lng,
          description: typeof item.description === 'string' ? item.description : undefined,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      }
    }

    return validated;
  } catch {
    return [];
  }
}
