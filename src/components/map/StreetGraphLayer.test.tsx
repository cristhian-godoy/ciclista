import { render } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { settingsStore } from '../../store/settingsStore';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';
import { StreetGraphLayer } from './StreetGraphLayer';

describe('StreetGraphLayer Component', () => {
  let mockMap: Partial<maplibregl.Map>;
  let addedLayers: Record<string, { id: string; layout: Record<string, unknown> }>;
  let addedSources: Record<string, { type?: string; data?: unknown }>;
  let eventListeners: Record<string, Record<string, Array<() => void>>>;
  let canvasStyle: { cursor: string };
  let setLayoutPropertyMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    settingsStore.resetSettings();
    addedLayers = {};
    addedSources = {};
    eventListeners = {};
    canvasStyle = { cursor: '' };

    setLayoutPropertyMock = vi.fn((layerId: string, prop: string, value: unknown) => {
      if (addedLayers[layerId]) {
        addedLayers[layerId].layout = {
          ...addedLayers[layerId].layout,
          [prop]: value,
        };
      }
    });

    mockMap = {
      getCanvas: vi.fn(() => ({ style: canvasStyle }) as unknown as HTMLCanvasElement),
      getSource: vi.fn((id: string) => addedSources[id]),
      addSource: vi.fn((id: string, spec: unknown) => {
        addedSources[id] = { ...(spec as Record<string, unknown>), setData: vi.fn() };
      }),
      removeSource: vi.fn((id: string) => {
        delete addedSources[id];
      }),
      getLayer: vi.fn((id: string) => addedLayers[id]),
      addLayer: vi.fn((layer: { id: string; layout?: Record<string, unknown> }) => {
        addedLayers[layer.id] = layer;
      }),
      removeLayer: vi.fn((id: string) => {
        delete addedLayers[id];
      }),
      setLayoutProperty: setLayoutPropertyMock as unknown as maplibregl.Map['setLayoutProperty'],
      setPaintProperty: vi.fn(),
      setFilter: vi.fn(),
      on: vi.fn((event: string, layerId: string, handler: () => void) => {
        if (!eventListeners[event]) eventListeners[event] = {};
        if (!eventListeners[event][layerId]) eventListeners[event][layerId] = [];
        eventListeners[event][layerId].push(handler);
        return mockMap as maplibregl.Map;
      }) as unknown as maplibregl.Map['on'],
      off: vi.fn((event: string, layerId: string, handler: () => void) => {
        if (eventListeners[event]?.[layerId]) {
          eventListeners[event][layerId] = eventListeners[event][layerId].filter(
            (h) => h !== handler,
          );
        }
        return mockMap as maplibregl.Map;
      }) as unknown as maplibregl.Map['off'],
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
      brushRadius: 40,
      setBrushRadius: vi.fn(),
      events: [],
      setEvents: vi.fn(),
      onClearSelection: vi.fn(),
      ...contextOverrides,
    };

    return render(
      <MapContext.Provider value={defaultContext}>
        <StreetGraphLayer />
      </MapContext.Provider>,
    );
  };

  it('registers traffic light circle layers with visibility none when appMode is routing', () => {
    renderWithContext({ appMode: 'routing' });

    expect(addedLayers['traffic-lights-cluster']).toBeDefined();
    expect(addedLayers['traffic-lights-cluster'].layout.visibility).toBe('none');

    expect(addedLayers['traffic-lights-unclustered']).toBeDefined();
    expect(addedLayers['traffic-lights-unclustered'].layout.visibility).toBe('none');
  });

  it('registers traffic light circle layers with visibility visible when appMode is edit', () => {
    renderWithContext({ appMode: 'edit' });

    expect(addedLayers['traffic-lights-cluster']).toBeDefined();
    expect(addedLayers['traffic-lights-cluster'].layout.visibility).toBe('visible');

    expect(addedLayers['traffic-lights-unclustered']).toBeDefined();
    expect(addedLayers['traffic-lights-unclustered'].layout.visibility).toBe('visible');
  });

  it('registers traffic light circle layers with visibility visible when appMode is undefined (legacy behavior)', () => {
    renderWithContext({ appMode: undefined });

    expect(addedLayers['traffic-lights-cluster']).toBeDefined();
    expect(addedLayers['traffic-lights-cluster'].layout.visibility).toBe('visible');

    expect(addedLayers['traffic-lights-unclustered']).toBeDefined();
    expect(addedLayers['traffic-lights-unclustered'].layout.visibility).toBe('visible');
  });

  it('sets visibility to none if showTrafficSignals setting is disabled even in edit mode', () => {
    settingsStore.updateSettings({ showTrafficSignals: false });

    renderWithContext({ appMode: 'edit' });

    expect(addedLayers['traffic-lights-cluster'].layout.visibility).toBe('none');
    expect(addedLayers['traffic-lights-unclustered'].layout.visibility).toBe('none');
  });

  it('imperatively toggles layer visibility via setLayoutProperty when switching appMode', () => {
    const { rerender } = renderWithContext({ appMode: 'routing' });

    expect(setLayoutPropertyMock).toHaveBeenCalledWith(
      'traffic-lights-cluster',
      'visibility',
      'none',
    );
    expect(setLayoutPropertyMock).toHaveBeenCalledWith(
      'traffic-lights-unclustered',
      'visibility',
      'none',
    );
    setLayoutPropertyMock.mockClear();

    // Switch to edit mode
    rerender(
      <MapContext.Provider
        value={{
          ...({} as MapContextType),
          map: mockMap as maplibregl.Map,
          appMode: 'edit',
          managedNodeIds: [],
          managedClusterId: null,
          customNodeDelays: new Map(),
          showMinorControls: false,
          graph: null,
        }}
      >
        <StreetGraphLayer />
      </MapContext.Provider>,
    );

    expect(setLayoutPropertyMock).toHaveBeenCalledWith(
      'traffic-lights-cluster',
      'visibility',
      'visible',
    );
    expect(setLayoutPropertyMock).toHaveBeenCalledWith(
      'traffic-lights-unclustered',
      'visibility',
      'visible',
    );
  });

  it('only applies pointer cursor on hover in edit mode and suppresses it in routing mode', () => {
    const { rerender } = renderWithContext({ appMode: 'edit' });

    const enterHandler = eventListeners['mouseenter']?.['traffic-lights-cluster']?.[0];
    const leaveHandler = eventListeners['mouseleave']?.['traffic-lights-cluster']?.[0];

    expect(enterHandler).toBeDefined();
    expect(leaveHandler).toBeDefined();

    // In edit mode: enter sets pointer cursor, leave resets it
    enterHandler!();
    expect(canvasStyle.cursor).toBe('pointer');

    leaveHandler!();
    expect(canvasStyle.cursor).toBe('');

    // Switch to routing mode
    rerender(
      <MapContext.Provider
        value={{
          ...({} as MapContextType),
          map: mockMap as maplibregl.Map,
          appMode: 'routing',
          managedNodeIds: [],
          managedClusterId: null,
          customNodeDelays: new Map(),
          showMinorControls: false,
          graph: null,
        }}
      >
        <StreetGraphLayer />
      </MapContext.Provider>,
    );

    const routingEnterHandler = eventListeners['mouseenter']?.['traffic-lights-cluster']?.[0];
    expect(routingEnterHandler).toBeDefined();

    canvasStyle.cursor = '';
    routingEnterHandler!();
    expect(canvasStyle.cursor).toBe('');
  });
});
