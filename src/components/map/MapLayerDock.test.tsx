import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { MapContextType } from './MapContext';
import { MapContext } from './MapContext';
import { MapLayerDock } from './MapLayerDock';

const defaultContextValue: MapContextType = {
  map: null,
  setMap: vi.fn(),
  mapReady: false,
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
  navigationState: {
    status: 'idle',
    cameraMode: 'heading-up',
    snapped: null,
    raw: null,
    progress: null,
    routeCoordinates: [],
    startTimestamp: null,
  },
  isNavigating: false,
  rideStats: null,
  onStopNavigation: vi.fn(),
  isInspectorModeActive: false,
  selectedNodeId: null,
  setSelectedNodeId: vi.fn(),
};

describe('MapLayerDock', () => {
  it('renders expanded mode with show/hide minor controls button', async () => {
    const user = userEvent.setup();
    const handleSetShowMinor = vi.fn();
    const handleSetDockExpanded = vi.fn();

    const contextValue: MapContextType = {
      ...defaultContextValue,
      showMinorControls: false,
      setShowMinorControls: handleSetShowMinor,
      dockExpanded: true,
      setDockExpanded: handleSetDockExpanded,
    };

    render(
      <MapContext.Provider value={contextValue}>
        <MapLayerDock />
      </MapContext.Provider>,
    );

    expect(screen.getByText('Map Layers')).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Show Minor Controls/i });
    expect(toggleBtn).toBeInTheDocument();

    await user.click(toggleBtn);
    expect(handleSetShowMinor).toHaveBeenCalled();

    // Click collapse button
    const buttons = screen.getAllByRole('button');
    const collapseBtn = buttons[1]; // ChevronDown button
    await user.click(collapseBtn);
    expect(handleSetDockExpanded).toHaveBeenCalledWith(false);
  });

  it('renders collapsed mode showing sliders expand button', async () => {
    const user = userEvent.setup();
    const handleSetDockExpanded = vi.fn();

    const contextValue: MapContextType = {
      ...defaultContextValue,
      showMinorControls: false,
      setShowMinorControls: vi.fn(),
      dockExpanded: false,
      setDockExpanded: handleSetDockExpanded,
    };

    render(
      <MapContext.Provider value={contextValue}>
        <MapLayerDock />
      </MapContext.Provider>,
    );

    expect(screen.queryByText('Map Layers')).not.toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: /Show Map Controls/i });
    expect(expandBtn).toBeInTheDocument();

    await user.click(expandBtn);
    expect(handleSetDockExpanded).toHaveBeenCalledWith(true);
  });
});
