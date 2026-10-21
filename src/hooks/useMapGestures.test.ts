import { renderHook } from '@testing-library/react';
import type * as maplibregl from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StreetGraph } from '../core/graph/types';
import { useMapGestures } from './useMapGestures';

describe('useMapGestures', () => {
  let mockMap: Partial<maplibregl.Map>;
  let onMock: ReturnType<typeof vi.fn>;
  let offMock: ReturnType<typeof vi.fn>;
  let disableDragPanMock: ReturnType<typeof vi.fn>;
  let enableDragPanMock: ReturnType<typeof vi.fn>;
  let disableDragRotateMock: ReturnType<typeof vi.fn>;
  let enableDragRotateMock: ReturnType<typeof vi.fn>;
  let setSelectedEdgeIdsMock: ReturnType<typeof vi.fn>;

  const nodes = new Map();
  nodes.set('node-1', {
    node: { id: 'node-1', lat: 48.137, lng: 11.575, tags: {} },
    edges: [{ target: 'node-2', distance: 100, tags: {} }],
  });
  nodes.set('node-2', {
    node: { id: 'node-2', lat: 48.138, lng: 11.576, tags: {} },
    edges: [{ target: 'node-1', distance: 100, tags: {} }],
  });
  const mockGraph = { nodes } as unknown as StreetGraph;

  beforeEach(() => {
    onMock = vi.fn();
    offMock = vi.fn();
    disableDragPanMock = vi.fn();
    enableDragPanMock = vi.fn();
    disableDragRotateMock = vi.fn();
    enableDragRotateMock = vi.fn();
    setSelectedEdgeIdsMock = vi.fn();

    mockMap = {
      on: onMock,
      off: offMock,
      dragPan: {
        disable: disableDragPanMock,
        enable: enableDragPanMock,
        isEnabled: vi.fn(),
      } as unknown as maplibregl.Map['dragPan'],
      dragRotate: {
        disable: disableDragRotateMock,
        enable: enableDragRotateMock,
        isEnabled: vi.fn(),
      } as unknown as maplibregl.Map['dragRotate'],
    };
  });

  it('attaches mousedown, mousemove, mouseup listeners when appMode is studio/events', () => {
    const { unmount } = renderHook(() =>
      useMapGestures({
        map: mockMap as maplibregl.Map,
        appMode: 'studio',
        graph: mockGraph,
        selectionTool: 'brush',
        brushRadius: 50,
        setSelectedEdgeIds: setSelectedEdgeIdsMock,
      }),
    );

    expect(onMock).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(onMock).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(onMock).toHaveBeenCalledWith('mouseup', expect.any(Function));

    unmount();

    expect(offMock).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(offMock).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(offMock).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });

  it('does not attach listeners when appMode is routing', () => {
    renderHook(() =>
      useMapGestures({
        map: mockMap as maplibregl.Map,
        appMode: 'routing',
        graph: mockGraph,
        selectionTool: 'brush',
        brushRadius: 50,
        setSelectedEdgeIds: setSelectedEdgeIdsMock,
      }),
    );

    expect(onMock).not.toHaveBeenCalled();
  });

  it('disables dragPan and selects edges on left-click drag with brush tool', () => {
    renderHook(() =>
      useMapGestures({
        map: mockMap as maplibregl.Map,
        appMode: 'studio',
        graph: mockGraph,
        selectionTool: 'brush',
        brushRadius: 200,
        setSelectedEdgeIds: setSelectedEdgeIdsMock,
      }),
    );

    const onMouseDown = onMock.mock.calls.find((c) => c[0] === 'mousedown')?.[1];
    expect(onMouseDown).toBeDefined();

    onMouseDown({
      originalEvent: { button: 0 },
      lngLat: { lat: 48.137, lng: 11.575 },
    });

    expect(disableDragPanMock).toHaveBeenCalled();
    expect(setSelectedEdgeIdsMock).toHaveBeenCalled();
  });

  it('disables dragPan and dragRotate and deselects edges on right-click drag with brush tool', () => {
    const preventDefaultMock = vi.fn();

    renderHook(() =>
      useMapGestures({
        map: mockMap as maplibregl.Map,
        appMode: 'events',
        graph: mockGraph,
        selectionTool: 'brush',
        brushRadius: 200,
        setSelectedEdgeIds: setSelectedEdgeIdsMock,
      }),
    );

    const onMouseDown = onMock.mock.calls.find((c) => c[0] === 'mousedown')?.[1];
    expect(onMouseDown).toBeDefined();

    onMouseDown({
      originalEvent: { button: 2, preventDefault: preventDefaultMock },
      lngLat: { lat: 48.137, lng: 11.575 },
    });

    expect(preventDefaultMock).toHaveBeenCalled();
    expect(disableDragPanMock).toHaveBeenCalled();
    expect(disableDragRotateMock).toHaveBeenCalled();
    expect(setSelectedEdgeIdsMock).toHaveBeenCalled();
  });
});
