import { render } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StreetGraph } from '../../core/graph/types';
import {
  BRUSH_CIRCLE_FILL_LAYER_ID,
  BRUSH_CIRCLE_LINE_LAYER_ID,
  BRUSH_CIRCLE_SOURCE_ID,
  BrushCircleLayer,
} from './BrushCircleLayer';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';

describe('BrushCircleLayer Component', () => {
  let mockMap: Partial<maplibregl.Map>;
  let mockSource: { setData: ReturnType<typeof vi.fn> };
  let mockCanvas: HTMLCanvasElement;
  let canvasListeners: Record<string, ((...args: unknown[]) => void)[]>;
  let mapListeners: Record<string, ((...args: unknown[]) => void)[]>;
  let defaultContext: MapContextType;

  beforeEach(() => {
    mockSource = {
      setData: vi.fn(),
    };

    canvasListeners = {};
    mapListeners = {};

    mockCanvas = {
      addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!canvasListeners[event]) canvasListeners[event] = [];
        canvasListeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (canvasListeners[event]) {
          canvasListeners[event] = canvasListeners[event].filter((h) => h !== handler);
        }
      }),
    } as unknown as HTMLCanvasElement;

    const sources = new Set<string>();

    mockMap = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!mapListeners[event]) mapListeners[event] = [];
        mapListeners[event].push(handler);
      }),
      off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (mapListeners[event]) {
          mapListeners[event] = mapListeners[event].filter((h) => h !== handler);
        }
      }),
      getSource: vi.fn((id: string) =>
        id === BRUSH_CIRCLE_SOURCE_ID && sources.has(id) ? mockSource : undefined,
      ) as unknown as maplibregl.Map['getSource'],
      addSource: vi.fn((id: string) => {
        sources.add(id);
      }),
      removeSource: vi.fn((id: string) => {
        sources.delete(id);
      }),
      getLayer: vi.fn(() => undefined),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      getCanvas: vi.fn(() => mockCanvas),
    } as unknown as Partial<maplibregl.Map>;

    const emptyGraph: StreetGraph = { nodes: new Map() };

    defaultContext = {
      map: mockMap as maplibregl.Map,
      setMap: vi.fn(),
      mapReady: true,
      setMapReady: vi.fn(),
      graph: emptyGraph,
      loadedBBoxes: [],
      startCoord: null,
      endCoord: null,
      routeVariants: [],
      activeAlternativeLabel: 'standard',
      onSelectAlternative: vi.fn(),
      customNodeDelays: new Map(),
      customNodeNotes: new Map(),
      customNodeTurns: new Map(),
      selectedNode: null,
      onStartDrag: vi.fn(),
      onEndDrag: vi.fn(),
      onNodeSelect: vi.fn(),
      onSaveNodeOverride: vi.fn(),
      onSaveNodeTurns: vi.fn(),
      onClearNodeOverride: vi.fn(),
      theme: 'bright',
      isInspectorModeActive: false,
      onToggleInspectorMode: vi.fn(),
      selectedNodeId: null,
      setSelectedNodeId: vi.fn(),
      selectedAlternativeTargetId: null,
      setSelectedAlternativeTargetId: vi.fn(),
      inspectorBranches: [],
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
      navigationState: {
        status: 'idle',
        cameraMode: 'north-up',
        snapped: null,
        raw: null,
        progress: null,
        routeCoordinates: [],
        startTimestamp: null,
      },
      isNavigating: false,
      rideStats: null,
      onStopNavigation: vi.fn(),
      appMode: 'studio',
      setAppMode: vi.fn(),
      landmarks: [],
      setLandmarks: vi.fn(),
      selectedEdgeIds: [],
      setSelectedEdgeIds: vi.fn(),
      selectionTool: 'brush',
      setSelectionTool: vi.fn(),
      brushRadius: 50,
      setBrushRadius: vi.fn(),
      events: [],
      setEvents: vi.fn(),
      onClearSelection: vi.fn(),
      landmarkModal: {
        isOpen: false,
        landmark: null,
        initialCoordinates: null,
      },
      setLandmarkModal: vi.fn(),
      openCreateLandmarkModal: vi.fn(),
      openEditLandmarkModal: vi.fn(),
      closeLandmarkModal: vi.fn(),
      onCreateLandmark: vi.fn(),
      onUpdateLandmark: vi.fn(),
      onDeleteLandmark: vi.fn(),
    };
  });

  it('registers source and preview layers on mount and unregisters on unmount', () => {
    const { unmount } = render(
      <MapContext.Provider value={defaultContext}>
        <BrushCircleLayer />
      </MapContext.Provider>,
    );

    expect(mockMap.addSource).toHaveBeenCalledWith(
      BRUSH_CIRCLE_SOURCE_ID,
      expect.objectContaining({ type: 'geojson' }),
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: BRUSH_CIRCLE_FILL_LAYER_ID, type: 'fill' }),
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: BRUSH_CIRCLE_LINE_LAYER_ID, type: 'line' }),
    );

    // Mock layer presence for unmount cleanup check
    (mockMap.getLayer as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({}) as unknown as maplibregl.LayerSpecification,
    );

    unmount();

    expect(mockMap.removeLayer).toHaveBeenCalledWith(BRUSH_CIRCLE_LINE_LAYER_ID);
    expect(mockMap.removeLayer).toHaveBeenCalledWith(BRUSH_CIRCLE_FILL_LAYER_ID);
    expect(mockMap.removeSource).toHaveBeenCalledWith(BRUSH_CIRCLE_SOURCE_ID);
  });

  it('updates circle preview geometry on mousemove when in studio brush mode', () => {
    render(
      <MapContext.Provider value={defaultContext}>
        <BrushCircleLayer />
      </MapContext.Provider>,
    );

    const mouseMoveHandler = mapListeners['mousemove']?.[0];
    expect(mouseMoveHandler).toBeDefined();

    mouseMoveHandler({
      lngLat: { lat: 48.137, lng: 11.575 },
    });

    expect(mockSource.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FeatureCollection',
        features: [
          expect.objectContaining({
            type: 'Feature',
            geometry: expect.objectContaining({ type: 'Polygon' }),
            properties: { radius: 50 },
          }),
        ],
      }),
    );
  });

  it('clears preview when mouse leaves map canvas or window', () => {
    render(
      <MapContext.Provider value={defaultContext}>
        <BrushCircleLayer />
      </MapContext.Provider>,
    );

    const mouseLeaveHandler = mapListeners['mouseout']?.[0];
    expect(mouseLeaveHandler).toBeDefined();

    mouseLeaveHandler();

    expect(mockSource.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('clears preview when selectionTool is click instead of brush', () => {
    const clickContext = {
      ...defaultContext,
      selectionTool: 'click' as const,
    };

    render(
      <MapContext.Provider value={clickContext}>
        <BrushCircleLayer />
      </MapContext.Provider>,
    );

    expect(mockSource.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('clears preview when appMode is routing instead of studio', () => {
    const routingContext = {
      ...defaultContext,
      appMode: 'routing' as const,
    };

    render(
      <MapContext.Provider value={routingContext}>
        <BrushCircleLayer />
      </MapContext.Provider>,
    );

    expect(mockSource.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    });
  });
});
