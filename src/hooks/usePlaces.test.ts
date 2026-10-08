import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePlaces } from './usePlaces';

describe('usePlaces Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with empty places when storage is empty', () => {
    const { result } = renderHook(() => usePlaces());
    expect(result.current.places).toEqual([]);
    expect(result.current.landmarks).toEqual([]);
  });

  it('adds a new place and updates state', () => {
    const { result } = renderHook(() => usePlaces());

    act(() => {
      result.current.addPlace({
        name: 'Home Apartment',
        category: 'home',
        lat: 48.137,
        lng: 11.575,
        description: 'Main apartment',
      });
    });

    expect(result.current.places).toHaveLength(1);
    expect(result.current.places[0]?.name).toBe('Home Apartment');
    expect(result.current.places[0]?.category).toBe('home');
  });

  it('updates an existing place', () => {
    const { result } = renderHook(() => usePlaces());

    let createdId = '';
    act(() => {
      const created = result.current.addPlace({
        name: 'Office',
        category: 'work',
        lat: 48.14,
        lng: 11.58,
      });
      createdId = created.id;
    });

    act(() => {
      result.current.updatePlace(createdId, {
        name: 'HQ Office',
        description: 'Building B',
      });
    });

    expect(result.current.places[0]?.name).toBe('HQ Office');
    expect(result.current.places[0]?.description).toBe('Building B');
    expect(result.current.places[0]?.category).toBe('work');
  });

  it('deletes a place by ID', () => {
    const { result } = renderHook(() => usePlaces());

    let idToDelete = '';
    act(() => {
      const p1 = result.current.addPlace({
        name: 'Doctor A',
        category: 'doctor',
        lat: 48.1,
        lng: 11.5,
      });
      result.current.addPlace({
        name: 'Gym',
        category: 'other',
        lat: 48.2,
        lng: 11.6,
      });
      idToDelete = p1.id;
    });

    expect(result.current.places).toHaveLength(2);

    act(() => {
      result.current.deletePlace(idToDelete);
    });

    expect(result.current.places).toHaveLength(1);
    expect(result.current.places[0]?.name).toBe('Gym');
  });

  it('clears all places', () => {
    const { result } = renderHook(() => usePlaces());

    act(() => {
      result.current.addPlace({
        name: 'Place 1',
        category: 'other',
        lat: 48.1,
        lng: 11.5,
      });
      result.current.addPlace({
        name: 'Place 2',
        category: 'other',
        lat: 48.2,
        lng: 11.6,
      });
    });

    expect(result.current.places).toHaveLength(2);

    act(() => {
      result.current.clearPlaces();
    });

    expect(result.current.places).toEqual([]);
  });
});
