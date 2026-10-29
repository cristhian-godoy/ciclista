import { renderHook } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMapCursor } from './useMapCursor';

describe('useMapCursor', () => {
  let mockCanvas: { style: { cursor: string } };
  let mockMap: Partial<maplibregl.Map>;

  beforeEach(() => {
    mockCanvas = { style: { cursor: '' } };
    mockMap = {
      getCanvas: vi.fn(() => mockCanvas as unknown as HTMLCanvasElement),
    };
  });

  it('sets cursor to crosshair when isPlacingPlace is true and resets on unmount', () => {
    const { unmount } = renderHook(() =>
      useMapCursor({
        map: mockMap as maplibregl.Map,
        isPlacingPlace: true,
      }),
    );

    expect(mockCanvas.style.cursor).toBe('crosshair');

    unmount();
    expect(mockCanvas.style.cursor).toBe('');
  });

  it('resets cursor to empty string when isPlacingPlace is false', () => {
    mockCanvas.style.cursor = 'crosshair';

    renderHook(() =>
      useMapCursor({
        map: mockMap as maplibregl.Map,
        isPlacingPlace: false,
      }),
    );

    expect(mockCanvas.style.cursor).toBe('');
  });

  it('calls setIsPlacingPlace(false) when Escape key is pressed during placement mode', () => {
    const setIsPlacingPlaceMock = vi.fn();

    renderHook(() =>
      useMapCursor({
        map: mockMap as maplibregl.Map,
        isPlacingPlace: true,
        setIsPlacingPlace: setIsPlacingPlaceMock,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(setIsPlacingPlaceMock).toHaveBeenCalledWith(false);
  });

  it('does not listen for Escape key when isPlacingPlace is false', () => {
    const setIsPlacingPlaceMock = vi.fn();

    renderHook(() =>
      useMapCursor({
        map: mockMap as maplibregl.Map,
        isPlacingPlace: false,
        setIsPlacingPlace: setIsPlacingPlaceMock,
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(setIsPlacingPlaceMock).not.toHaveBeenCalled();
  });

  it('suppresses crosshair and resets placement when appMode is non-places mode', () => {
    const setIsPlacingPlaceMock = vi.fn();

    renderHook(() =>
      useMapCursor({
        map: mockMap as maplibregl.Map,
        isPlacingPlace: true,
        setIsPlacingPlace: setIsPlacingPlaceMock,
        appMode: 'edit',
      }),
    );

    expect(mockCanvas.style.cursor).toBe('');
    expect(setIsPlacingPlaceMock).toHaveBeenCalledWith(false);
  });

  it('allows crosshair when appMode is places mode', () => {
    renderHook(() =>
      useMapCursor({
        map: mockMap as maplibregl.Map,
        isPlacingPlace: true,
        appMode: 'places',
      }),
    );

    expect(mockCanvas.style.cursor).toBe('crosshair');
  });
});
