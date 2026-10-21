import type * as maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import type { SelectionTool } from '../components/map/contexts/StudioStateContext';
import { findEdgesWithinRadius } from '../core/common/geometry';
import type { StreetGraph } from '../core/graph/types';

/**
 * Configuration options for useMapGestures hook.
 */
export interface UseMapGesturesOptions {
  /** MapLibre map instance */
  map?: maplibregl.Map | null;
  /** Active application mode */
  appMode?: string;
  /** Street network graph */
  graph?: StreetGraph | null;
  /** Active studio selection tool */
  selectionTool?: SelectionTool;
  /** Radius for brush selection tool in meters */
  brushRadius?: number;
  /** State setter for selected edge identifiers */
  setSelectedEdgeIds?: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * Hook to manage brush drag gestures (select on left-click drag, deselect on right-click drag)
 * during studio and events modes.
 */
export function useMapGestures({
  map,
  appMode,
  graph,
  selectionTool = 'click',
  brushRadius = 20,
  setSelectedEdgeIds,
}: UseMapGesturesOptions): void {
  const graphRef = useRef(graph);
  const brushRadiusRef = useRef(brushRadius);
  const selectionToolRef = useRef(selectionTool);
  const setSelectedEdgeIdsRef = useRef(setSelectedEdgeIds);

  useEffect(() => {
    graphRef.current = graph;
    brushRadiusRef.current = brushRadius;
    selectionToolRef.current = selectionTool;
    setSelectedEdgeIdsRef.current = setSelectedEdgeIds;
  }, [graph, brushRadius, selectionTool, setSelectedEdgeIds]);

  useEffect(() => {
    const isEventsMode = appMode === 'events' || (appMode as string) === 'studio';
    if (!map || !isEventsMode) return;

    let isLeftDown = false;
    let isRightDown = false;

    const handleBrushAt = (coord: { lat: number; lng: number }) => {
      const currentGraph = graphRef.current;
      if (!currentGraph) return;
      const currentRadius = brushRadiusRef.current;
      const matching = findEdgesWithinRadius(currentGraph, coord, currentRadius);
      if (matching.length > 0) {
        setSelectedEdgeIdsRef.current?.((prev) => {
          const set = new Set(prev);
          let changed = false;
          for (const edgeId of matching) {
            if (!set.has(edgeId)) {
              set.add(edgeId);
              changed = true;
            }
          }
          return changed ? Array.from(set) : prev;
        });
      }
    };

    const handleDeselectAt = (coord: { lat: number; lng: number }) => {
      const currentGraph = graphRef.current;
      if (!currentGraph || selectionToolRef.current !== 'brush') return;
      const currentRadius = brushRadiusRef.current;
      const matching = findEdgesWithinRadius(currentGraph, coord, currentRadius);
      if (matching.length > 0) {
        const toRemove = new Set(matching);
        setSelectedEdgeIdsRef.current?.((prev) => prev.filter((id) => !toRemove.has(id)));
      }
    };

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button === 0 && selectionToolRef.current === 'brush') {
        isLeftDown = true;
        map.dragPan?.disable?.();
        handleBrushAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      } else if (e.originalEvent.button === 2 && selectionToolRef.current === 'brush') {
        isRightDown = true;
        e.originalEvent?.preventDefault?.();
        map.dragPan?.disable?.();
        map.dragRotate?.disable?.();
        handleDeselectAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (isLeftDown && selectionToolRef.current === 'brush') {
        handleBrushAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      } else if (isRightDown && selectionToolRef.current === 'brush') {
        handleDeselectAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    };

    const onMouseUp = () => {
      if (isLeftDown) {
        isLeftDown = false;
        map.dragPan?.enable?.();
      }
      if (isRightDown) {
        isRightDown = false;
        map.dragPan?.enable?.();
        map.dragRotate?.enable?.();
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      window.removeEventListener('mouseup', onMouseUp);
      map.dragPan?.enable?.();
      map.dragRotate?.enable?.();
    };
  }, [map, appMode]);
}
