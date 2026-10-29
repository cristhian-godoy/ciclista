import { render } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Coordinate } from '../../core/common/types';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';
import { StartEndMarkers } from './StartEndMarkers';

describe('StartEndMarkers Component', () => {
  let mockMap: Partial<maplibregl.Map>;
  let onStartDragMock: ReturnType<typeof vi.fn>;
  let onEndDragMock: ReturnType<typeof vi.fn>;
  let setShouldFitBoundsMock: ReturnType<typeof vi.fn>;

  const defaultStartCoord: Coordinate = { lat: 48.137, lng: 11.575 };
  const defaultEndCoord: Coordinate = { lat: 48.145, lng: 11.585 };

  beforeEach(() => {
    onStartDragMock = vi.fn();
    onEndDragMock = vi.fn();
    setShouldFitBoundsMock = vi.fn();

    mockMap = {
      easeTo: vi.fn(),
    } as unknown as Partial<maplibregl.Map>;
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
    };

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

    const defaultContext: MapContextType = {
      map: mockMap as maplibregl.Map,
      setMap: vi.fn(),
      mapReady: true,
      setMapReady: vi.fn(),
      graph: null,
      loadedBBoxes: [],
      startCoord: defaultStartCoord,
      endCoord: defaultEndCoord,
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
      appMode: 'edit',
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
    };

    rerender(
      <MapContext.Provider value={defaultContext}>
        <StartEndMarkers />
      </MapContext.Provider>,
    );

    markerElements = document.querySelectorAll('div[style*="border-radius: 50%"]');
    markerElements.forEach((el) => {
      expect((el as HTMLElement).style.cursor).toBe('default');
    });
  });
});
