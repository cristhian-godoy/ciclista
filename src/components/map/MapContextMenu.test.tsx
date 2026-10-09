import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { Coordinate } from '../../core/common/types';
import type { Landmark } from '../../core/landmarks/types';
import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';
import { MapContextMenu } from './MapContextMenu';

describe('MapContextMenu Component', () => {
  let mockMap: Partial<maplibregl.Map>;
  let setContextMenuMock: ReturnType<typeof vi.fn>;
  let onStartDragMock: Mock<(coord: Coordinate | null) => void>;
  let onEndDragMock: Mock<(coord: Coordinate | null) => void>;
  let openCreateLandmarkModalMock: Mock<(coord?: Coordinate | null) => void>;
  let openEditLandmarkModalMock: Mock<(landmark: Landmark) => void>;
  let onDeleteLandmarkMock: Mock<(id: string) => void>;

  beforeEach(() => {
    setContextMenuMock = vi.fn();
    onStartDragMock = vi.fn();
    onEndDragMock = vi.fn();
    openCreateLandmarkModalMock = vi.fn();
    openEditLandmarkModalMock = vi.fn();
    onDeleteLandmarkMock = vi.fn();

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
      startCoord: null,
      endCoord: null,
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
      setShouldFitBounds: vi.fn(),
      showMinorControls: false,
      setShowMinorControls: vi.fn(),
      dockExpanded: false,
      setDockExpanded: vi.fn(),
      managedClusterId: null,
      setManagedClusterId: vi.fn(),
      managedNodeIds: [],
      setManagedNodeIds: vi.fn(),
      contextMenu: {
        visible: true,
        x: 100,
        y: 200,
        lng: 11.575,
        lat: 48.137,
        crossingId: null,
        nodeIds: null,
      },
      setContextMenu: setContextMenuMock as unknown as MapContextType['setContextMenu'],
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
      openCreateLandmarkModal: openCreateLandmarkModalMock,
      openEditLandmarkModal: openEditLandmarkModalMock,
      closeLandmarkModal: vi.fn(),
      onCreateLandmark: vi.fn(),
      onUpdateLandmark: vi.fn(),
      onDeleteLandmark: onDeleteLandmarkMock,
      ...contextOverrides,
    };

    return render(
      <MapContext.Provider value={defaultContext}>
        <MapContextMenu />
      </MapContext.Provider>,
    );
  };

  it('renders context menu options including Add Place', () => {
    renderWithContext();

    expect(screen.getByRole('button', { name: /Add Place/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Route Here/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /End Route Here/i })).toBeInTheDocument();
  });

  it('calls openCreateLandmarkModal with spatial coordinates on clicking Add Place', async () => {
    const user = userEvent.setup();
    renderWithContext();

    const addPlaceBtn = screen.getByRole('button', { name: /Add Place/i });
    await user.click(addPlaceBtn);

    expect(openCreateLandmarkModalMock).toHaveBeenCalledWith({
      lat: 48.137,
      lng: 11.575,
    });
    expect(setContextMenuMock).toHaveBeenCalled();
  });

  it('renders Add Place even when active navigation is in progress', () => {
    renderWithContext({ isNavigating: true });

    expect(screen.getByRole('button', { name: /Add Place/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Route Here/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /End Route Here/i })).not.toBeInTheDocument();
  });

  it('triggers start and end route drag callbacks when not navigating', async () => {
    const user = userEvent.setup();
    renderWithContext({ isNavigating: false });

    await user.click(screen.getByRole('button', { name: /Start Route Here/i }));
    expect(onStartDragMock).toHaveBeenCalledWith({ lat: 48.137, lng: 11.575 });

    await user.click(screen.getByRole('button', { name: /End Route Here/i }));
    expect(onEndDragMock).toHaveBeenCalledWith({ lat: 48.137, lng: 11.575 });
  });

  it('renders place-specific options when right clicking an existing place', async () => {
    const user = userEvent.setup();
    const samplePlace: Landmark = {
      id: 'place-home',
      name: 'Home',
      category: 'home',
      lat: 48.137,
      lng: 11.575,
      createdAt: 1000,
      updatedAt: 1000,
    };

    renderWithContext({
      landmarks: [samplePlace],
      contextMenu: {
        visible: true,
        x: 150,
        y: 200,
        lat: 48.137,
        lng: 11.575,
        crossingId: null,
        nodeIds: null,
        placeId: 'place-home',
      },
    });

    expect(screen.getByRole('button', { name: /Edit Place/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Set as Start/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Set as Destination/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Place/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Place/i })).not.toBeInTheDocument();

    // Clicking Edit Place opens edit modal
    await user.click(screen.getByRole('button', { name: /Edit Place/i }));
    expect(openEditLandmarkModalMock).toHaveBeenCalledWith(samplePlace);
    expect(setContextMenuMock).toHaveBeenCalled();
  });

  it('triggers set as start, set as destination, and delete for a right-clicked place', async () => {
    const user = userEvent.setup();
    const samplePlace: Landmark = {
      id: 'place-office',
      name: 'Office',
      category: 'work',
      lat: 48.145,
      lng: 11.585,
      createdAt: 1000,
      updatedAt: 1000,
    };

    renderWithContext({
      landmarks: [samplePlace],
      contextMenu: {
        visible: true,
        x: 150,
        y: 200,
        lat: 48.145,
        lng: 11.585,
        crossingId: null,
        nodeIds: null,
        placeId: 'place-office',
      },
    });

    await user.click(screen.getByRole('button', { name: /Set as Start/i }));
    expect(onStartDragMock).toHaveBeenCalledWith({ lat: 48.145, lng: 11.585 });

    await user.click(screen.getByRole('button', { name: /Set as Destination/i }));
    expect(onEndDragMock).toHaveBeenCalledWith({ lat: 48.145, lng: 11.585 });

    await user.click(screen.getByRole('button', { name: /Delete Place/i }));
    expect(onDeleteLandmarkMock).toHaveBeenCalledWith('place-office');
  });

  it('does not render when contextMenu.visible is false', () => {
    const { container } = renderWithContext({
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        lng: 0,
        lat: 0,
        crossingId: null,
        nodeIds: null,
      },
    });

    expect(container.firstChild).toBeNull();
  });
});
