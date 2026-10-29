import { render } from '@testing-library/react';
import * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Coordinate } from '../../core/common/types';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';
import { StartEndMarkers } from './StartEndMarkers';

describe('StartEndMarkers Component', () => {
  let mockMap: Partial<maplibregl.Map>;
  let onStartDragMock: ReturnType<typeof vi.fn>;
  let onEndDragMock: ReturnType<typeof vi.fn>;
  let onUpdateWaypointMock: ReturnType<typeof vi.fn>;
  let setShouldFitBoundsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onStartDragMock = vi.fn();
    onEndDragMock = vi.fn();
    onUpdateWaypointMock = vi.fn();
    setShouldFitBoundsMock = vi.fn();

    mockMap = {
      easeTo: vi.fn(),
      getCenter: vi.fn(() => ({ lat: 48.137, lng: 11.575 }) as unknown as maplibregl.LngLat),
    };
  });

  const renderWithContext = (contextOverrides: Partial<MapContextType> = {}) => {
    const defaultContext: MapContextType = {
      map: mockMap as maplibregl.Map,
      setMap: vi.fn(),
      mapReady: true,
      setMapReady: vi.fn(),
      graph: null,
      loadedBBoxes: [],
      startCoord: null,
      endCoord: null,
      waypoints: [],
      onAddWaypoint: vi.fn(),
      onRemoveWaypoint: vi.fn(),
      onUpdateWaypoint: onUpdateWaypointMock,
      onReorderWaypoints: vi.fn(),
      isPlacingStop: false,
      placingStopIndex: null,
      routeVariants: [],
      activeAlternativeLabel: 'standard',
      onSelectAlternative: vi.fn(),
      customNodeDelays: new Map(),
      customNodeNotes: new Map(),
      customNodeTurns: new Map(),
      selectedNode: null,
      onStartDrag: onStartDragMock,
      onEndDrag: onEndDragMock,
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
      setShouldFitBounds: setShouldFitBoundsMock,
      showMinorControls: false,
      setShowMinorControls: vi.fn(),
      dockExpanded: false,
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
      appMode: 'routing',
      setAppMode: vi.fn(),
      places: [],
      setPlaces: vi.fn(),
      landmarks: [],
      setLandmarks: vi.fn(),
      selectedEdgeIds: [],
      setSelectedEdgeIds: vi.fn(),
      selectionTool: 'click',
      brushRadius: 40,
      events: [],
      setEvents: vi.fn(),
      openCreateLandmarkModal: vi.fn(),
      openCreatePlaceModal: vi.fn(),
      openEditLandmarkModal: vi.fn(),
      openEditPlaceModal: vi.fn(),
      closeLandmarkModal: vi.fn(),
      closePlaceModal: vi.fn(),
      onDeleteLandmark: vi.fn(),
      onDeletePlace: vi.fn(),
      isPlacingPlace: false,
      setIsPlacingPlace: vi.fn(),
      activeCrossingId: null,
      setActiveCrossingId: vi.fn(),
      activeTurnSelection: undefined,
      setActiveTurnSelection: vi.fn(),
      crossingTurns: [],
      onSaveCrossingTurn: vi.fn(),
      onDeleteCrossingTurn: vi.fn(),
      ...contextOverrides,
    } as unknown as MapContextType;

    return render(
      <MapContext.Provider value={defaultContext}>
        <StartEndMarkers />
      </MapContext.Provider>,
    );
  };

  it('renders start, end, and numbered intermediate waypoint markers', () => {
    const waypoints: Coordinate[] = [
      { lat: 48.14, lng: 11.58 },
      { lat: 48.145, lng: 11.585 },
    ];

    renderWithContext({
      startCoord: { lat: 48.13, lng: 11.57 },
      endCoord: { lat: 48.16, lng: 11.6 },
      waypoints,
    });

    expect(setShouldFitBoundsMock).toHaveBeenCalled();
  });

  it('updates marker draggability when isNavigating changes', () => {
    const waypoints: Coordinate[] = [{ lat: 48.14, lng: 11.58 }];

    const { rerender } = renderWithContext({
      startCoord: { lat: 48.13, lng: 11.57 },
      endCoord: { lat: 48.16, lng: 11.6 },
      waypoints,
      isNavigating: false,
    });

    rerender(
      <MapContext.Provider
        value={
          {
            map: mockMap as maplibregl.Map,
            startCoord: { lat: 48.13, lng: 11.57 },
            endCoord: { lat: 48.16, lng: 11.6 },
            waypoints,
            isNavigating: true,
            setShouldFitBounds: setShouldFitBoundsMock,
          } as unknown as MapContextType
        }
      >
        <StartEndMarkers />
      </MapContext.Provider>,
    );
  });

  it('triggers onUpdateWaypoint when waypoint marker drag ends', () => {
    type MockMarker = maplibregl.Marker & {
      element?: HTMLElement;
      lngLat?: [number, number];
      events: Record<string, ((...args: unknown[]) => void)[]>;
    };

    const capturedMarkers: MockMarker[] = [];
    const originalOn = maplibregl.Marker.prototype.on;
    const onSpy = vi.spyOn(maplibregl.Marker.prototype, 'on').mockImplementation(function (
      this: MockMarker,
      event: keyof maplibregl.MarkerEventType,
      handler: (event: maplibregl.MarkerDragEvent | maplibregl.MarkerClickEvent) => void,
    ) {
      if (this.element?.className?.includes('ciclista-waypoint-marker')) {
        capturedMarkers.push(this);
      }
      return originalOn.call(this, event, handler);
    });

    renderWithContext({
      waypoints: [{ lat: 48.14, lng: 11.58 }],
    });

    const capturedMarker = capturedMarkers[0];
    expect(capturedMarker).toBeDefined();
    if (capturedMarker) {
      capturedMarker.lngLat = [11.59, 48.15];
      capturedMarker.events['dragend']?.forEach((fn) => fn());
      expect(onUpdateWaypointMock).toHaveBeenCalledWith(0, { lat: 48.15, lng: 11.59 });
    }

    onSpy.mockRestore();
  });
});
