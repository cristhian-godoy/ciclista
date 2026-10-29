import { act, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useMapContext } from './MapContext';
import { MapProvider, type MapProviderProps } from './MapProvider';

describe('MapProvider Mode Transition Lifecycle', () => {
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
    rulesConfig: {
      avoidHills: false,
      prioritizeBikePaths: true,
      avoidCobblestones: false,
      penalizeDismount: true,
      penalizeBicycleNo: true,
    },
    bikeConfig: {
      maxSpeed: 25,
      weight: 15,
      power: 200,
    },
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
});
