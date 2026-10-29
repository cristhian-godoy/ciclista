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

  const defaultStartCoord: Coordinate = { lat: 48.137, lng: 11.575 };
  const defaultEndCoord: Coordinate = { lat: 48.145, lng: 11.585 };

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
      startCoord: defaultStartCoord,
      endCoord: defaultEndCoord,
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
      setSelectionTool: vi.fn(),
      brushRadius: 20,
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
      ...contextOverrides,
    } as unknown as MapContextType;

    return render(
      <MapContext.Provider value={defaultContext}>
        <StartEndMarkers />
      </MapContext.Provider>,
    );
  };

  it('renders start and end markers as draggable with grab cursor in routing mode', () => {
    renderWithContext({ appMode: 'routing', isNavigating: false });

    const markerElements = document.querySelectorAll('div[style*="border-radius: 50%"]');
    expect(markerElements.length).toBe(2);

    markerElements.forEach((el) => {
      expect((el as HTMLElement).style.cursor).toBe('grab');
    });
  });

  it('freezes markers with default cursor when in edit mode', () => {
    renderWithContext({ appMode: 'edit', isNavigating: false });

    const markerElements = document.querySelectorAll('div[style*="border-radius: 50%"]');
    expect(markerElements.length).toBe(2);

    markerElements.forEach((el) => {
      expect((el as HTMLElement).style.cursor).toBe('default');
    });
  });

  it('freezes markers with default cursor when in events mode', () => {
    renderWithContext({ appMode: 'events', isNavigating: false });

    const markerElements = document.querySelectorAll('div[style*="border-radius: 50%"]');
    expect(markerElements.length).toBe(2);

    markerElements.forEach((el) => {
      expect((el as HTMLElement).style.cursor).toBe('default');
    });
  });

  it('freezes markers with default cursor when in places mode', () => {
    renderWithContext({ appMode: 'places', isNavigating: false });

    const markerElements = document.querySelectorAll('div[style*="border-radius: 50%"]');
    expect(markerElements.length).toBe(2);

    markerElements.forEach((el) => {
      expect((el as HTMLElement).style.cursor).toBe('default');
    });
  });

  it('freezes markers with default cursor when active turn-by-turn navigation is in progress', () => {
    renderWithContext({ appMode: 'routing', isNavigating: true });

    const markerElements = document.querySelectorAll('div[style*="border-radius: 50%"]');
    expect(markerElements.length).toBe(2);

    markerElements.forEach((el) => {
      expect((el as HTMLElement).style.cursor).toBe('default');
    });
  });

  it('updates marker cursor dynamically when transitioning from routing mode to edit mode', () => {
    const { rerender } = renderWithContext({ appMode: 'routing', isNavigating: false });

    let markerElements = document.querySelectorAll('div[style*="border-radius: 50%"]');
    markerElements.forEach((el) => {
      expect((el as HTMLElement).style.cursor).toBe('grab');
    });

    rerender(
      <MapContext.Provider
        value={
          {
            map: mockMap as maplibregl.Map,
            startCoord: defaultStartCoord,
            endCoord: defaultEndCoord,
            waypoints: [],
            appMode: 'edit',
            isNavigating: false,
            setShouldFitBounds: setShouldFitBoundsMock,
          } as unknown as MapContextType
        }
      >
        <StartEndMarkers />
      </MapContext.Provider>,
    );

    markerElements = document.querySelectorAll('div[style*="border-radius: 50%"]');
    markerElements.forEach((el) => {
      expect((el as HTMLElement).style.cursor).toBe('default');
    });
  });

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
