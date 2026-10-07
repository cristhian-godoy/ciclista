import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useLandmarks } from './useLandmarks';

describe('useLandmarks Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with empty landmarks when storage is empty', () => {
    const { result } = renderHook(() => useLandmarks());
    expect(result.current.landmarks).toEqual([]);
  });

  it('adds a new landmark and updates state', () => {
    const { result } = renderHook(() => useLandmarks());

    act(() => {
      result.current.addLandmark({
        name: 'Home Apartment',
        category: 'home',
        lat: 48.137,
        lng: 11.575,
        description: 'Main apartment',
      });
    });

    expect(result.current.landmarks).toHaveLength(1);
    expect(result.current.landmarks[0]?.name).toBe('Home Apartment');
    expect(result.current.landmarks[0]?.category).toBe('home');
  });

  it('updates an existing landmark', () => {
    const { result } = renderHook(() => useLandmarks());

    let createdId = '';
    act(() => {
      const created = result.current.addLandmark({
        name: 'Office',
        category: 'work',
        lat: 48.14,
        lng: 11.58,
      });
      createdId = created.id;
    });

    act(() => {
      result.current.updateLandmark(createdId, {
        name: 'HQ Office',
        description: 'Building B',
      });
    });

    expect(result.current.landmarks[0]?.name).toBe('HQ Office');
    expect(result.current.landmarks[0]?.description).toBe('Building B');
    expect(result.current.landmarks[0]?.category).toBe('work');
  });

  it('deletes a landmark by ID', () => {
    const { result } = renderHook(() => useLandmarks());

    let idToDelete = '';
    act(() => {
      const l1 = result.current.addLandmark({
        name: 'Doctor A',
        category: 'doctor',
        lat: 48.1,
        lng: 11.5,
      });
      result.current.addLandmark({
        name: 'Gym',
        category: 'leisure',
        lat: 48.2,
        lng: 11.6,
      });
      idToDelete = l1.id;
    });

    expect(result.current.landmarks).toHaveLength(2);

    act(() => {
      result.current.deleteLandmark(idToDelete);
    });

    expect(result.current.landmarks).toHaveLength(1);
    expect(result.current.landmarks[0]?.name).toBe('Gym');
  });

  it('clears all landmarks', () => {
    const { result } = renderHook(() => useLandmarks());

    act(() => {
      result.current.addLandmark({
        name: 'Place 1',
        category: 'other',
        lat: 48.1,
        lng: 11.5,
      });
      result.current.addLandmark({
        name: 'Place 2',
        category: 'shop',
        lat: 48.2,
        lng: 11.6,
      });
    });

    expect(result.current.landmarks).toHaveLength(2);

    act(() => {
      result.current.clearLandmarks();
    });

    expect(result.current.landmarks).toEqual([]);
  });
});
