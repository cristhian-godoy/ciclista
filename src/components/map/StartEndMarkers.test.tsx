import { act, render } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { settingsStore } from '../../store/settingsStore';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';
import { StartEndMarkers } from './StartEndMarkers';

// Mock maplibre-gl Marker
const markerInstances: Array<{
  element: HTMLElement;
  draggable: boolean;
  setDraggable: ReturnType<typeof vi.fn>;
  setLngLat: ReturnType<typeof vi.fn>;
  addTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  getElement: () => HTMLElement;
  getLngLat: () => { lat: number; lng: number };
}> = [];

vi.mock('maplibre-gl', () => {
  return {
    Marker: vi.fn().mockImplementation(function ({
      element,
      draggable,
    }: {
      element: HTMLElement;
      draggable: boolean;
    }) {
      const instance = {
        element,
        draggable,
        setDraggable: vi.fn((val: boolean) => {
          instance.draggable = val;
          return instance;
        }),
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
        on: vi.fn(),
        getElement: () => element,
        getLngLat: () => ({ lat: 48.137, lng: 11.575 }),
      };
      markerInstances.push(instance);
      return instance;
    }),
  };
});

describe('StartEndMarkers Component', () => {
  let mockMap: Partial<maplibregl.Map>;

  beforeEach(() => {
    markerInstances.length = 0;
    settingsStore.resetSettings();
    mockMap = {
      easeTo: vi.fn(),
    } as unknown as Partial<maplibregl.Map>;
  });

  const renderMarkers = (contextOverrides: Partial<MapContextType> = {}) => {
    const defaultContext: MapContextType = {
      map: mockMap as maplibregl.Map,
      setMap: vi.fn(),
      mapReady: true,
      setMapReady: vi.fn(),
      graph: null,
      loadedBBoxes: [],
      startCoord: { lat: 48.137, lng: 11.575 },
      endCoord: { lat: 48.138, lng: 11.576 },
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
      shouldFitBounds: false,
      setShouldFitBounds: vi.fn(),
      activeCrossingId: null,
      setActiveCrossingId: vi.fn(),
      crossingTurns: new Map(),
      onSaveCrossingTurn: vi.fn(),
      onDeleteCrossingTurn: vi.fn(),
      managedClusterId: null,
      setManagedClusterId: vi.fn(),
      managedNodeIds: [],
      setManagedNodeIds: vi.fn(),
      showMinorControls: false,
      setShowMinorControls: vi.fn(),
      isInspectorModeActive: false,
      onToggleInspectorMode: vi.fn(),
      selectedNodeId: null,
      setSelectedNodeId: vi.fn(),
      selectedAlternativeTargetId: null,
      setSelectedAlternativeTargetId: vi.fn(),
      contextMenu: { visible: false, x: 0, y: 0, lng: 0, lat: 0 },
      setContextMenu: vi.fn(),
      dockExpanded: false,
      setDockExpanded: vi.fn(),
      navigationState: { status: 'idle', cameraMode: 'free', currentStepIndex: 0, progress: 0 },
      isNavigating: false,
      rideStats: {
        currentSpeedKmh: 0,
        averageSpeedKmh: 0,
        maxSpeedKmh: 0,
        elapsedTimeSeconds: 0,
        distanceCoveredMeters: 0,
        remainingDistanceMeters: 0,
        remainingDurationSeconds: 0,
      },
      onStopNavigation: vi.fn(),
      theme: 'bright',
      appMode: 'routing',
      onAppModeChange: vi.fn(),
      places: [],
      onPlacesChange: vi.fn(),
      onCreatePlace: vi.fn(),
      onUpdatePlace: vi.fn(),
      onDeletePlace: vi.fn(),
      landmarks: [],
      onLandmarksChange: vi.fn(),
      onCreateLandmark: vi.fn(),
      onUpdateLandmark: vi.fn(),
      onDeleteLandmark: vi.fn(),
      openCreateLandmarkModal: vi.fn(),
      openEditLandmarkModal: vi.fn(),
      events: [],
      onEventsChange: vi.fn(),
      selectedEdgeIds: [],
      onSelectedEdgeIdsChange: vi.fn(),
      selectionTool: 'click',
      onSelectionToolChange: vi.fn(),
      brushRadius: 20,
      onBrushRadiusChange: vi.fn(),
      ...contextOverrides,
    };

    return render(
      <MapContext.Provider value={defaultContext}>
        <StartEndMarkers />
      </MapContext.Provider>,
    );
  };

  it('renders draggable start and end markers in routing mode by default', () => {
    renderMarkers({ appMode: 'routing' });

    expect(markerInstances).toHaveLength(2);
    expect(markerInstances[0]?.draggable).toBe(true);
    expect(markerInstances[1]?.draggable).toBe(true);
  });

  it('freezes markers and updates cursor/title when in edit mode with freezePinsOnEditMode enabled', () => {
    settingsStore.updateSettings({ freezePinsOnEditMode: true });
    renderMarkers({ appMode: 'edit' });

    expect(markerInstances).toHaveLength(2);
    expect(markerInstances[0]?.draggable).toBe(false);
    expect(markerInstances[1]?.draggable).toBe(false);

    expect(markerInstances[0]?.element.style.cursor).toBe('default');
    expect(markerInstances[0]?.element.title).toContain('frozen in Edit mode');
    expect(markerInstances[1]?.element.style.cursor).toBe('default');
    expect(markerInstances[1]?.element.title).toContain('frozen in Edit mode');
  });

  it('unfreezes markers dynamically when freezePinsOnEditMode is disabled in settings', () => {
    settingsStore.updateSettings({ freezePinsOnEditMode: true });
    renderMarkers({ appMode: 'edit' });

    expect(markerInstances[0]?.draggable).toBe(false);

    act(() => {
      settingsStore.updateSettings({ freezePinsOnEditMode: false });
    });

    expect(markerInstances[0]?.setDraggable).toHaveBeenCalledWith(true);
    expect(markerInstances[1]?.setDraggable).toHaveBeenCalledWith(true);
    expect(markerInstances[0]?.element.style.cursor).toBe('grab');
    expect(markerInstances[0]?.element.title).toBe('Origin pin (draggable)');
  });
});
