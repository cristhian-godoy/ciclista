/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NavigationState } from '../../core/navigation/types';
import { MapContext, MapContextType } from './MapContext';
import { NavigationLayer } from './NavigationLayer';

const mockNavigationState: NavigationState = {
  status: 'active',
  cameraMode: 'heading-up',
  snapped: {
    coordinate: { lat: 48.137154, lng: 11.576124 },
    bearing: 45,
    segmentIndex: 0,
    fractionAlongSegment: 0.5,
    distanceFromRawM: 2.0,
  },
  progress: {
    distanceCoveredM: 50,
    distanceRemainingM: 150,
    etaSeconds: 30,
    elapsedSeconds: 10,
    averageSpeedKmh: 18,
    currentSpeedKmh: 20,
  },
  routeCoordinates: [
    { lat: 48.137, lng: 11.576 },
    { lat: 48.138, lng: 11.577 },
  ],
  startTimestamp: 1000,
};

describe('NavigationLayer', () => {
  let mockMap: any;
  let mockSource: any;
  let defaultContextValue: MapContextType;
  let canvasContextSpy: any;

  beforeEach(() => {
    // Mock HTMLCanvasElement getContext to prevent throwing in test environment
    canvasContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(48 * 48 * 4),
        width: 48,
        height: 48,
      }),
    } as any);

    mockSource = {
      setData: vi.fn(),
    };

    let imageAdded = false;
    let sourceAdded = false;
    let layerAdded = false;

    mockMap = {
      hasImage: vi.fn().mockImplementation((id: string) => {
        return id === 'nav-arrow' ? imageAdded : false;
      }),
      addImage: vi.fn().mockImplementation((id: string) => {
        if (id === 'nav-arrow') imageAdded = true;
      }),
      removeImage: vi.fn().mockImplementation((id: string) => {
        if (id === 'nav-arrow') imageAdded = false;
      }),
      getSource: vi.fn().mockImplementation((id: string) => {
        if (id === 'nav-position') {
          return sourceAdded ? mockSource : null;
        }
        return null;
      }),
      addSource: vi.fn().mockImplementation((id: string) => {
        if (id === 'nav-position') sourceAdded = true;
      }),
      removeSource: vi.fn().mockImplementation((id: string) => {
        if (id === 'nav-position') sourceAdded = false;
      }),
      getLayer: vi.fn().mockImplementation((id: string) => {
        if (id === 'nav-position-layer') {
          return layerAdded ? {} : null;
        }
        return null;
      }),
      addLayer: vi.fn().mockImplementation((layer: any) => {
        if (layer.id === 'nav-position-layer') layerAdded = true;
      }),
      removeLayer: vi.fn().mockImplementation((id: string) => {
        if (id === 'nav-position-layer') layerAdded = false;
      }),
      setLayoutProperty: vi.fn(),
      easeTo: vi.fn(),
    };

    defaultContextValue = {
      map: mockMap,
      setMap: vi.fn(),
      mapReady: true,
      setMapReady: vi.fn(),
      graph: null,
      loadedBBoxes: [],
      startCoord: null,
      endCoord: null,
      routeAlternatives: [],
      activeAlternativeLabel: 'standard',
      onSelectAlternative: vi.fn(),
      selectedPreset: 'munich',
      customNodeDelays: new Map(),
      customNodeNotes: new Map(),
      selectedNode: null,
      onStartDrag: vi.fn(),
      onEndDrag: vi.fn(),
      onNodeSelect: vi.fn(),
      onSaveNodeOverride: vi.fn(),
      onClearNodeOverride: vi.fn(),
      theme: 'bright',
      shouldFitBounds: false,
      setShouldFitBounds: vi.fn(),
      showMinorControls: false,
      setShowMinorControls: vi.fn(),
      dockExpanded: true,
      setDockExpanded: vi.fn(),
      managedClusterId: null,
      setManagedClusterId: vi.fn(),
      managedNodeIds: [],
      setManagedNodeIds: vi.fn(),
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        lng: 0,
        lat: 0,
        crossingId: null,
        nodeIds: null,
      },
      setContextMenu: vi.fn(),
      navigationState: mockNavigationState,
      isNavigating: true,
      rideStats: null,
      onStopNavigation: vi.fn(),
    };
  });

  afterEach(() => {
    canvasContextSpy.mockRestore();
  });

  it('adds source, layer, and arrow image on mount', () => {
    render(
      <MapContext.Provider value={defaultContextValue}>
        <NavigationLayer />
      </MapContext.Provider>,
    );

    expect(mockMap.hasImage).toHaveBeenCalledWith('nav-arrow');
    expect(mockMap.addImage).toHaveBeenCalled();
    expect(mockMap.getSource).toHaveBeenCalledWith('nav-position');
    expect(mockMap.addSource).toHaveBeenCalledWith('nav-position', expect.any(Object));
    expect(mockMap.getLayer).toHaveBeenCalledWith('nav-position-layer');
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'nav-position-layer',
        type: 'symbol',
        source: 'nav-position',
      }),
    );
  });

  it('removes resources on unmount', () => {
    // Mount first so they are added
    const { unmount } = render(
      <MapContext.Provider value={defaultContextValue}>
        <NavigationLayer />
      </MapContext.Provider>,
    );

    unmount();

    expect(mockMap.removeLayer).toHaveBeenCalledWith('nav-position-layer');
    expect(mockMap.removeSource).toHaveBeenCalledWith('nav-position');
    expect(mockMap.removeImage).toHaveBeenCalledWith('nav-arrow');
  });

  it('toggles visibility of the layer depending on navigation state', () => {
    const { rerender } = render(
      <MapContext.Provider value={defaultContextValue}>
        <NavigationLayer />
      </MapContext.Provider>,
    );

    expect(mockMap.setLayoutProperty).toHaveBeenLastCalledWith(
      'nav-position-layer',
      'visibility',
      'visible',
    );

    const pausedContext = {
      ...defaultContextValue,
      isNavigating: false,
    };

    rerender(
      <MapContext.Provider value={pausedContext}>
        <NavigationLayer />
      </MapContext.Provider>,
    );

    expect(mockMap.setLayoutProperty).toHaveBeenLastCalledWith(
      'nav-position-layer',
      'visibility',
      'none',
    );
  });

  it('updates GeoJSON source coordinates when snapped position changes', () => {
    render(
      <MapContext.Provider value={defaultContextValue}>
        <NavigationLayer />
      </MapContext.Provider>,
    );

    expect(mockSource.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FeatureCollection',
        features: [
          expect.objectContaining({
            geometry: {
              type: 'Point',
              coordinates: [11.576124, 48.137154],
            },
            properties: {
              bearing: 45,
            },
          }),
        ],
      }),
    );
  });

  it('triggers camera easeTo heading-up settings', () => {
    render(
      <MapContext.Provider value={defaultContextValue}>
        <NavigationLayer />
      </MapContext.Provider>,
    );

    expect(mockMap.easeTo).toHaveBeenCalledWith({
      center: [11.576124, 48.137154],
      bearing: 45,
      zoom: 17,
      pitch: 45,
      duration: 300,
    });
  });

  it('triggers camera easeTo north-up settings', () => {
    const northUpContext = {
      ...defaultContextValue,
      navigationState: {
        ...mockNavigationState,
        cameraMode: 'north-up' as const,
      },
    };

    render(
      <MapContext.Provider value={northUpContext}>
        <NavigationLayer />
      </MapContext.Provider>,
    );

    expect(mockMap.easeTo).toHaveBeenCalledWith({
      center: [11.576124, 48.137154],
      bearing: 0,
      zoom: 16,
      pitch: 0,
      duration: 300,
    });
  });

  it('debounces camera easing updates', () => {
    const { rerender } = render(
      <MapContext.Provider value={defaultContextValue}>
        <NavigationLayer />
      </MapContext.Provider>,
    );

    expect(mockMap.easeTo).toHaveBeenCalledTimes(1);

    // Call updates immediately (below 250ms)
    const updatedContext = {
      ...defaultContextValue,
      navigationState: {
        ...mockNavigationState,
        snapped: {
          coordinate: { lat: 48.1372, lng: 11.5762 },
          bearing: 50,
          segmentIndex: 0,
          fractionAlongSegment: 0.6,
          distanceFromRawM: 1.0,
        },
      },
    };

    rerender(
      <MapContext.Provider value={updatedContext}>
        <NavigationLayer />
      </MapContext.Provider>,
    );

    // EaseTo should not have been called a second time due to 250ms debounce
    expect(mockMap.easeTo).toHaveBeenCalledTimes(1);
  });
});
