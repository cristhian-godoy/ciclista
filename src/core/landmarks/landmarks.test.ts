import { describe, expect, it } from 'vitest';

import {
  calculateHaversineDistance,
  createLandmark,
  deleteLandmark,
  deserializeLandmarks,
  filterLandmarks,
  findNearestLandmark,
  isValidCategory,
  LANDMARK_CATEGORIES,
  serializeLandmarks,
  sortLandmarks,
  updateLandmark,
  validateLandmarkInput,
} from './landmarks';
import type { CreateLandmarkInput, Landmark, LandmarkCategory } from './types';

describe('Landmarks Domain Logic', () => {
  describe('isValidCategory', () => {
    it('returns true for all registered categories', () => {
      for (const desc of LANDMARK_CATEGORIES) {
        expect(isValidCategory(desc.category)).toBe(true);
      }
    });

    it('returns false for unrecognized or malformed categories', () => {
      expect(isValidCategory('spaceship')).toBe(false);
      expect(isValidCategory('')).toBe(false);
      expect(isValidCategory(123)).toBe(false);
      expect(isValidCategory(null)).toBe(false);
      expect(isValidCategory(undefined)).toBe(false);
    });
  });

  describe('validateLandmarkInput', () => {
    it('accepts completely valid input', () => {
      const input: CreateLandmarkInput = {
        name: 'Apartment',
        category: 'home',
        lat: 48.137,
        lng: 11.575,
        description: 'Primary residence',
      };
      const result = validateLandmarkInput(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects empty or whitespace-only name', () => {
      const result1 = validateLandmarkInput({
        name: '',
        category: 'work',
        lat: 48.0,
        lng: 11.0,
      });
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Landmark name must not be empty.');

      const result2 = validateLandmarkInput({
        name: '   ',
        category: 'work',
        lat: 48.0,
        lng: 11.0,
      });
      expect(result2.valid).toBe(false);
    });

    it('rejects names exceeding 100 characters', () => {
      const longName = 'A'.repeat(101);
      const result = validateLandmarkInput({
        name: longName,
        category: 'home',
        lat: 48.0,
        lng: 11.0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Landmark name must not exceed 100 characters.');
    });

    it('rejects invalid or missing category', () => {
      const result = validateLandmarkInput({
        name: 'Dental Clinic',
        category: 'invalid_cat' as unknown as LandmarkCategory,
        lat: 48.0,
        lng: 11.0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid or missing landmark category.');
    });

    it('rejects latitude out of bounds or non-finite', () => {
      const resultOut1 = validateLandmarkInput({
        name: 'Test',
        category: 'home',
        lat: 95,
        lng: 10,
      });
      expect(resultOut1.valid).toBe(false);

      const resultOut2 = validateLandmarkInput({
        name: 'Test',
        category: 'home',
        lat: -91,
        lng: 10,
      });
      expect(resultOut2.valid).toBe(false);

      const resultNaN = validateLandmarkInput({
        name: 'Test',
        category: 'home',
        lat: Number.NaN,
        lng: 10,
      });
      expect(resultNaN.valid).toBe(false);
    });

    it('rejects longitude out of bounds or non-finite', () => {
      const resultOut1 = validateLandmarkInput({
        name: 'Test',
        category: 'home',
        lat: 48,
        lng: 185,
      });
      expect(resultOut1.valid).toBe(false);

      const resultOut2 = validateLandmarkInput({
        name: 'Test',
        category: 'home',
        lat: 48,
        lng: -181,
      });
      expect(resultOut2.valid).toBe(false);

      const resultInf = validateLandmarkInput({
        name: 'Test',
        category: 'home',
        lat: 48,
        lng: Number.POSITIVE_INFINITY,
      });
      expect(resultInf.valid).toBe(false);
    });

    it('rejects descriptions exceeding 500 characters', () => {
      const result = validateLandmarkInput({
        name: 'Office',
        category: 'work',
        lat: 48,
        lng: 11,
        description: 'X'.repeat(501),
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Description must not exceed 500 characters.');
    });
  });

  describe('createLandmark', () => {
    it('creates a landmark with valid fields, id, and timestamps', () => {
      const input: CreateLandmarkInput = {
        name: '  Office HQ  ',
        category: 'work',
        lat: 48.14,
        lng: 11.58,
        description: '  4th floor office  ',
      };

      const landmark = createLandmark(input);

      expect(landmark.id).toMatch(/^landmark-\d+-[a-z0-9]+$/);
      expect(landmark.name).toBe('Office HQ');
      expect(landmark.category).toBe('work');
      expect(landmark.lat).toBe(48.14);
      expect(landmark.lng).toBe(11.58);
      expect(landmark.description).toBe('4th floor office');
      expect(typeof landmark.createdAt).toBe('number');
      expect(landmark.createdAt).toBeGreaterThan(0);
      expect(landmark.updatedAt).toBe(landmark.createdAt);
    });

    it('throws error when creating landmark with invalid input', () => {
      expect(() =>
        createLandmark({
          name: '',
          category: 'home',
          lat: 48.0,
          lng: 11.0,
        }),
      ).toThrowError(/Invalid landmark input/);
    });
  });

  describe('updateLandmark', () => {
    it('updates specified fields and updates updatedAt timestamp', () => {
      const initial = createLandmark({
        name: 'Home',
        category: 'home',
        lat: 48.13,
        lng: 11.56,
      });

      const updated = updateLandmark(initial, {
        name: 'New House',
        category: 'home',
        lat: 48.15,
        description: 'Renovated villa',
      });

      expect(updated.id).toBe(initial.id);
      expect(updated.name).toBe('New House');
      expect(updated.lat).toBe(48.15);
      expect(updated.lng).toBe(11.56);
      expect(updated.description).toBe('Renovated villa');
      expect(updated.createdAt).toBe(initial.createdAt);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(initial.updatedAt);
    });

    it('throws error when update produces invalid state', () => {
      const initial = createLandmark({
        name: 'Doctor',
        category: 'doctor',
        lat: 48.13,
        lng: 11.56,
      });

      expect(() =>
        updateLandmark(initial, {
          name: '',
        }),
      ).toThrowError(/Invalid landmark update/);
    });
  });

  describe('deleteLandmark', () => {
    it('removes target landmark by id', () => {
      const l1 = createLandmark({ name: 'L1', category: 'home', lat: 48, lng: 11 });
      const l2 = createLandmark({ name: 'L2', category: 'work', lat: 48.1, lng: 11.1 });
      const l3 = createLandmark({ name: 'L3', category: 'doctor', lat: 48.2, lng: 11.2 });

      const result = deleteLandmark([l1, l2, l3], l2.id);
      expect(result).toHaveLength(2);
      expect(result.map((l) => l.id)).toEqual([l1.id, l3.id]);
    });

    it('returns unmodified array when id is not found', () => {
      const l1 = createLandmark({ name: 'L1', category: 'home', lat: 48, lng: 11 });
      const result = deleteLandmark([l1], 'unknown-id');
      expect(result).toHaveLength(1);
    });
  });

  describe('filterLandmarks', () => {
    const l1 = createLandmark({
      name: 'Central Hospital',
      category: 'doctor',
      lat: 48.13,
      lng: 11.57,
      description: 'Main emergency room',
    });
    const l2 = createLandmark({
      name: 'Suburban Clinic',
      category: 'doctor',
      lat: 48.18,
      lng: 11.6,
      description: 'Family doctor',
    });
    const l3 = createLandmark({
      name: 'Co-working Office',
      category: 'work',
      lat: 48.14,
      lng: 11.58,
    });
    const l4 = createLandmark({
      name: 'Downtown House',
      category: 'home',
      lat: 48.12,
      lng: 11.55,
    });

    const all = [l1, l2, l3, l4];

    it('filters by category', () => {
      const doctors = filterLandmarks(all, { category: 'doctor' });
      expect(doctors).toHaveLength(2);
      expect(doctors.every((l) => l.category === 'doctor')).toBe(true);

      const allCat = filterLandmarks(all, { category: 'all' });
      expect(allCat).toHaveLength(4);
    });

    it('filters by search term in name or description', () => {
      const matchingClinic = filterLandmarks(all, { search: 'clinic' });
      expect(matchingClinic).toHaveLength(1);
      expect(matchingClinic[0]?.name).toBe('Suburban Clinic');

      const matchingFamily = filterLandmarks(all, { search: 'family' });
      expect(matchingFamily).toHaveLength(1);
      expect(matchingFamily[0]?.name).toBe('Suburban Clinic');

      const matchingOffice = filterLandmarks(all, { search: 'office' });
      expect(matchingOffice).toHaveLength(1);
      expect(matchingOffice[0]?.name).toBe('Co-working Office');
    });

    it('combines category and search filter', () => {
      const result = filterLandmarks(all, { category: 'doctor', search: 'central' });
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Central Hospital');
    });
  });

  describe('sortLandmarks', () => {
    it('sorts by name alphabetically', () => {
      const lA = createLandmark({ name: 'Alpha', category: 'work', lat: 48, lng: 11 });
      const lB = createLandmark({ name: 'Beta', category: 'work', lat: 48, lng: 11 });
      const lC = createLandmark({ name: 'Gamma', category: 'work', lat: 48, lng: 11 });

      const sorted = sortLandmarks([lC, lA, lB], 'name');
      expect(sorted.map((l) => l.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('sorts by creation date newest first', () => {
      const l1: Landmark = {
        id: '1',
        name: 'Old',
        category: 'home',
        lat: 48,
        lng: 11,
        createdAt: 1000,
        updatedAt: 1000,
      };
      const l2: Landmark = {
        id: '2',
        name: 'New',
        category: 'home',
        lat: 48,
        lng: 11,
        createdAt: 2000,
        updatedAt: 2000,
      };

      const sorted = sortLandmarks([l1, l2], 'createdAt');
      expect(sorted[0]?.name).toBe('New');
      expect(sorted[1]?.name).toBe('Old');
    });

    it('sorts by category', () => {
      const lWork = createLandmark({ name: 'Office', category: 'work', lat: 48, lng: 11 });
      const lDoctor = createLandmark({ name: 'Doc', category: 'doctor', lat: 48, lng: 11 });
      const lHome = createLandmark({ name: 'Flat', category: 'home', lat: 48, lng: 11 });

      const sorted = sortLandmarks([lWork, lHome, lDoctor], 'category');
      expect(sorted.map((l) => l.category)).toEqual(['doctor', 'home', 'work']);
    });
  });

  describe('calculateHaversineDistance and findNearestLandmark', () => {
    it('computes distance between two coordinates accurately', () => {
      // Munich Marienplatz (48.137154, 11.576124) to Odeonsplatz (48.141755, 11.577265) ~ 520m
      const marienplatz = { lat: 48.137154, lng: 11.576124 };
      const odeonsplatz = { lat: 48.141755, lng: 11.577265 };

      const dist = calculateHaversineDistance(marienplatz, odeonsplatz);
      expect(dist).toBeGreaterThan(450);
      expect(dist).toBeLessThan(600);
    });

    it('finds nearest landmark in collection', () => {
      const lNear = createLandmark({ name: 'Near', category: 'home', lat: 48.138, lng: 11.576 });
      const lFar = createLandmark({ name: 'Far', category: 'work', lat: 48.2, lng: 11.7 });

      const target = { lat: 48.137, lng: 11.575 };
      const nearestResult = findNearestLandmark([lFar, lNear], target);

      expect(nearestResult).not.toBeNull();
      expect(nearestResult?.landmark.name).toBe('Near');
      expect(nearestResult?.distanceMeters).toBeLessThan(500);
    });

    it('returns null when landmarks collection is empty', () => {
      expect(findNearestLandmark([], { lat: 48, lng: 11 })).toBeNull();
    });
  });

  describe('serializeLandmarks and deserializeLandmarks', () => {
    it('roundtrips valid landmarks cleanly', () => {
      const l1 = createLandmark({
        name: 'Home',
        category: 'home',
        lat: 48.13,
        lng: 11.56,
        description: 'Sweet home',
      });
      const l2 = createLandmark({
        name: 'Office',
        category: 'work',
        lat: 48.14,
        lng: 11.58,
      });

      const serialized = serializeLandmarks([l1, l2]);
      const deserialized = deserializeLandmarks(serialized);

      expect(deserialized).toEqual([l1, l2]);
    });

    it('handles empty or malformed JSON gracefully', () => {
      expect(deserializeLandmarks('')).toEqual([]);
      expect(deserializeLandmarks('   ')).toEqual([]);
      expect(deserializeLandmarks('null')).toEqual([]);
      expect(deserializeLandmarks('{ "foo": "bar" }')).toEqual([]);
      expect(deserializeLandmarks('not a json string')).toEqual([]);
    });

    it('filters out corrupt or invalid landmark objects from array', () => {
      const mixed = JSON.stringify([
        {
          id: 'valid-1',
          name: 'Home',
          category: 'home',
          lat: 48.1,
          lng: 11.5,
          createdAt: 100,
          updatedAt: 100,
        },
        {
          id: 'invalid-no-name',
          category: 'work',
          lat: 48.1,
          lng: 11.5,
          createdAt: 100,
          updatedAt: 100,
        },
        {
          id: 'invalid-category',
          name: 'Invalid Cat',
          category: 'space-station',
          lat: 48.1,
          lng: 11.5,
          createdAt: 100,
          updatedAt: 100,
        },
        null,
        123,
      ]);

      const result = deserializeLandmarks(mixed);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Home');
    });
  });
});
