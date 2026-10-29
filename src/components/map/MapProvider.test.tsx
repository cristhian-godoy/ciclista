import { act, renderHook } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { BikeConfig, RulesConfiguration } from '../../core/config';
import type { NavigationState } from '../../core/navigation/types';
import type { ToolbarMode } from '../SideToolbar';
import { useCrossingEditorContext, useRoutingStateContext } from './contexts';
import { MapProvider, type MapProviderProps } from './MapProvider';

describe('MapProvider Crossing State Lifecycle and Teardown', () => {
  const baseProps: Omit<MapProviderProps, 'children'> = {
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
    rulesConfig: {} as RulesConfiguration,
    bikeConfig: {} as BikeConfig,
    navigationState: {
      status: 'idle',
      cameraMode: 'north-up',
      snapped: null,
      raw: null,
      progress: null,
      routeCoordinates: [],
      startTimestamp: null,
    } as NavigationState,
    isNavigating: false,
    rideStats: null,
    onStopNavigation: vi.fn(),
  };

  it('automatically resets activeTurnSelection whenever activeCrossingId changes', () => {
    const { result } = renderHook(
      () => ({
        crossing: useCrossingEditorContext(),
      }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MapProvider {...baseProps} appMode="edit">
            {children}
          </MapProvider>
        ),
      },
    );

    // Initial state
    expect(result.current.crossing.activeCrossingId).toBeNull();
    expect(result.current.crossing.activeTurnSelection).toEqual({
      fromNodeId: null,
      toNodeId: null,
      waypointNodeIds: [],
    });

    // 1. Select crossing and set turn selection
    act(() => {
      result.current.crossing.setActiveCrossingId?.('crossing-1');
      result.current.crossing.setActiveTurnSelection?.({
        fromNodeId: 'node-A',
        toNodeId: 'node-B',
        waypointNodeIds: ['node-W'],
      });
    });

    expect(result.current.crossing.activeCrossingId).toBe('crossing-1');
    expect(result.current.crossing.activeTurnSelection).toEqual({
      fromNodeId: 'node-A',
      toNodeId: 'node-B',
      waypointNodeIds: ['node-W'],
    });

    // 2. Switch crossing from crossing-1 to crossing-2 -> turn selection must automatically reset
    act(() => {
      result.current.crossing.setActiveCrossingId?.('crossing-2');
    });

    expect(result.current.crossing.activeCrossingId).toBe('crossing-2');
    expect(result.current.crossing.activeTurnSelection).toEqual({
      fromNodeId: null,
      toNodeId: null,
      waypointNodeIds: [],
    });

    // 3. Set dirty turn selection on crossing-2, then deselect crossing (set to null) -> turn selection must reset
    act(() => {
      result.current.crossing.setActiveTurnSelection?.({
        fromNodeId: 'node-X',
        toNodeId: 'node-Y',
        waypointNodeIds: [],
      });
    });

    expect(result.current.crossing.activeTurnSelection?.fromNodeId).toBe('node-X');

    act(() => {
      result.current.crossing.setActiveCrossingId?.(null);
    });

    expect(result.current.crossing.activeCrossingId).toBeNull();
    expect(result.current.crossing.activeTurnSelection).toEqual({
      fromNodeId: null,
      toNodeId: null,
      waypointNodeIds: [],
    });
  });

  it('automatically tears down activeCrossingId, activeTurnSelection, and managedClusterId when leaving edit mode', () => {
    let setModeExternally: (mode: ToolbarMode) => void = () => {};

    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const [currentMode, setCurrentMode] = useState<ToolbarMode>('edit');
      setModeExternally = setCurrentMode;

      return (
        <MapProvider {...baseProps} appMode={currentMode}>
          {children}
        </MapProvider>
      );
    };

    const { result } = renderHook(
      () => ({
        crossing: useCrossingEditorContext(),
        routing: useRoutingStateContext(),
      }),
      { wrapper: Wrapper },
    );

    // Setup active crossing and managed cluster state in edit mode
    act(() => {
      result.current.crossing.setActiveCrossingId?.('crossing-alpha');
      result.current.crossing.setActiveTurnSelection?.({
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        waypointNodeIds: ['node-3'],
      });
      result.current.routing.setManagedClusterId?.('cluster-alpha');
      result.current.routing.setManagedNodeIds?.(['node-1', 'node-2']);
    });

    expect(result.current.crossing.activeCrossingId).toBe('crossing-alpha');
    expect(result.current.crossing.activeTurnSelection?.fromNodeId).toBe('node-1');
    expect(result.current.routing.managedClusterId).toBe('cluster-alpha');

    // Transition appMode from 'edit' to 'routing'
    act(() => {
      setModeExternally('routing');
    });

    // Verify complete state teardown
    expect(result.current.crossing.activeCrossingId).toBeNull();
    expect(result.current.crossing.activeTurnSelection).toEqual({
      fromNodeId: null,
      toNodeId: null,
      waypointNodeIds: [],
    });
    expect(result.current.routing.managedClusterId).toBeNull();
    expect(result.current.routing.managedNodeIds).toEqual([]);
    expect(result.current.crossing.editSubMode).toBe('paths');
  });
});
