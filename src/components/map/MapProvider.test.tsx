import { act, render, renderHook } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { BikeConfig, RulesConfiguration } from '../../core/config';
import type { ToolbarMode } from '../SideToolbar';
import { useCrossingEditorContext, useRoutingStateContext } from './contexts';
import { useMapContext } from './MapContext';
import { MapProvider, type MapProviderProps } from './MapProvider';

describe('MapProvider Mode Transition Lifecycle & Crossing State Teardown', () => {
  const createBaseProps = (overrides: Partial<MapProviderProps> = {}): MapProviderProps => ({
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
    },
    isNavigating: false,
    rideStats: null,
    onStopNavigation: vi.fn(),
    children: null,
    ...overrides,
  });

  const baseProps = createBaseProps();

  it('resets isPlacingPlace and dismisses open context menu when appMode switches away from places', () => {
    let capturedContext: ReturnType<typeof useMapContext> | null = null;

    const Consumer = () => {
      capturedContext = useMapContext();
      return null;
    };

    const initialProps = createBaseProps({
      appMode: 'places',
      initialIsPlacingPlace: true,
      children: <Consumer />,
    });

    const { rerender } = render(<MapProvider {...initialProps} />);

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!.isPlacingPlace).toBe(true);

    // Open context menu while in places mode
    act(() => {
      capturedContext!.setContextMenu({
        visible: true,
        x: 100,
        y: 100,
        lat: 48.13,
        lng: 11.57,
        crossingId: null,
        nodeIds: null,
      });
    });

    expect(capturedContext!.contextMenu.visible).toBe(true);

    // Switch appMode to edit mode
    rerender(
      <MapProvider
        {...createBaseProps({
          appMode: 'edit',
          children: <Consumer />,
        })}
      />,
    );

    expect(capturedContext!.isPlacingPlace).toBe(false);
    expect(capturedContext!.contextMenu.visible).toBe(false);
  });

  it('resets selectionTool to click when switching away from events mode', () => {
    let capturedContext: ReturnType<typeof useMapContext> | null = null;

    const Consumer = () => {
      capturedContext = useMapContext();
      return null;
    };

    const initialProps = createBaseProps({
      appMode: 'events',
      initialSelectionTool: 'brush',
      children: <Consumer />,
    });

    const { rerender } = render(<MapProvider {...initialProps} />);

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!.selectionTool).toBe('brush');

    // Switch appMode to routing
    rerender(
      <MapProvider
        {...createBaseProps({
          appMode: 'routing',
          children: <Consumer />,
        })}
      />,
    );

    expect(capturedContext!.selectionTool).toBe('click');
  });

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
