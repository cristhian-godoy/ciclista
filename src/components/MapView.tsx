import type maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

import { findEdgesWithinRadius, findNearestEdge } from '../core/common/geometry';
import type { GraphNode } from '../core/graph/types';
import { ArrivalPanel } from './ArrivalPanel';
import { BBoxBoundaryLayer } from './map/BBoxBoundaryLayer';
import { BlockedEdgesLayer } from './map/BlockedEdgesLayer';
import { InspectorLayer } from './map/InspectorLayer';
import { LandmarksLayer } from './map/LandmarksLayer';
import { useMapContext } from './map/MapContext';
import { MapContextMenu } from './map/MapContextMenu';
import { MapLayerDock } from './map/MapLayerDock';
import { NavigationLayer } from './map/NavigationLayer';
import { NodePopup } from './map/NodePopup';
import { RouteVariantsLayer } from './map/RouteVariantsLayer';
import { SelectedEdgesLayer } from './map/SelectedEdgesLayer';
import { SelectionToolsDock } from './map/SelectionToolsDock';
import { StartEndMarkers } from './map/StartEndMarkers';
import { StreetGraphLayer } from './map/StreetGraphLayer';
import { useMapInstance } from './map/useMapInstance';
import { NavigationHUD } from './NavigationHUD';

interface MapViewProps {
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
  tileless?: boolean;
}

const MapViewContent: React.FC<{
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
  tileless?: boolean;
}> = ({ onMapBoundsChange, tileless = false }) => {
  const {
    map,
    setMap,
    mapReady,
    setMapReady,
    selectedPreset,
    theme,
    setContextMenu,
    setManagedClusterId,
    setManagedNodeIds,
    onNodeSelect,
    onStartDrag,
    onEndDrag,
    selectedNode,
    setDockExpanded,
    startCoord,
    endCoord,
    isNavigating,
    graph,
    appMode,
    selectedEdgeIds,
    setSelectedEdgeIds,
    selectionTool,
    brushRadius,
  } = useMapContext();

  const startCoordRef = useRef(startCoord);
  const endCoordRef = useRef(endCoord);
  const appModeRef = useRef(appMode);
  const selectedEdgeIdsRef = useRef(selectedEdgeIds);
  const selectionToolRef = useRef(selectionTool);
  const brushRadiusRef = useRef(brushRadius);
  const graphRef = useRef(graph);

  // Keep refs synchronized for event handlers
  useEffect(() => {
    startCoordRef.current = startCoord;
    endCoordRef.current = endCoord;
    appModeRef.current = appMode;
    selectedEdgeIdsRef.current = selectedEdgeIds;
    selectionToolRef.current = selectionTool;
    brushRadiusRef.current = brushRadius;
    graphRef.current = graph;
  }, [startCoord, endCoord, appMode, selectedEdgeIds, selectionTool, brushRadius, graph]);

  // Window click listener to close context menu
  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, [setContextMenu]);

  // Reset managed cluster state if selectedNode becomes null
  const prevSelectedNodeRef = useRef<GraphNode | null>(null);
  useEffect(() => {
    if (prevSelectedNodeRef.current !== null && selectedNode === null) {
      setManagedClusterId(null);
      setManagedNodeIds([]);
    }
    prevSelectedNodeRef.current = selectedNode;
  }, [selectedNode, setManagedClusterId, setManagedNodeIds]);

  // Studio mode drag gestures: left-click drag for Radius Brush, right-click drag for Deselection
  useEffect(() => {
    if (!map || appMode !== 'studio') return;

    let isLeftDown = false;
    let isRightDown = false;

    const handleBrushAt = (coord: { lat: number; lng: number }) => {
      const currentGraph = graphRef.current;
      if (!currentGraph) return;
      const currentRadius = brushRadiusRef.current;
      const matching = findEdgesWithinRadius(currentGraph, coord, currentRadius);
      if (matching.length > 0) {
        setSelectedEdgeIds((prev) => {
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
      if (!currentGraph) return;
      const currentRadius = selectionToolRef.current === 'brush' ? brushRadiusRef.current : 25;
      const matching = findEdgesWithinRadius(currentGraph, coord, currentRadius);
      if (matching.length > 0) {
        const toRemove = new Set(matching);
        setSelectedEdgeIds((prev) => prev.filter((id) => !toRemove.has(id)));
      }
    };

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button === 0 && selectionToolRef.current === 'brush') {
        isLeftDown = true;
        map.dragPan?.disable?.();
        handleBrushAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      } else if (e.originalEvent.button === 2) {
        isRightDown = true;
        e.originalEvent.preventDefault();
        map.dragPan?.disable?.();
        map.dragRotate?.disable?.();
        handleDeselectAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (isLeftDown && selectionToolRef.current === 'brush') {
        handleBrushAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      } else if (isRightDown) {
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
  }, [map, appMode, setSelectedEdgeIds]);

  // Handle right click on map (context menu trigger or studio deselection)
  const handleContextMenu = (e: maplibregl.MapMouseEvent) => {
    if (!map) return;

    if (appModeRef.current === 'studio') {
      e.originalEvent?.preventDefault?.();
      const currentGraph = graphRef.current;
      if (currentGraph) {
        const coord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        const radius = selectionToolRef.current === 'brush' ? brushRadiusRef.current : 25;
        const matching = findEdgesWithinRadius(currentGraph, coord, radius);
        if (matching.length > 0) {
          const toRemove = new Set(matching);
          setSelectedEdgeIds((prev) => prev.filter((id) => !toRemove.has(id)));
        } else {
          const nearest = findNearestEdge(currentGraph, coord);
          if (nearest && nearest.distance <= 30) {
            const idToRemove = `${nearest.uId}->${nearest.vId}`;
            setSelectedEdgeIds((prev) => prev.filter((id) => id !== idToRemove));
          }
        }
      }
      return;
    }

    const features = map.queryRenderedFeatures(e.point, {
      layers: ['traffic-lights-cluster'],
    });
    const isCrossing = features.length > 0;
    const crossingId =
      isCrossing && features[0].properties ? (features[0].properties.crossingId as string) : null;
    const nodeIds =
      isCrossing && features[0].properties ? (features[0].properties.nodeIds as string) : null;

    setContextMenu({
      visible: true,
      x: e.point.x,
      y: e.point.y,
      lng: e.lngLat.lng,
      lat: e.lngLat.lat,
      crossingId,
      nodeIds,
    });
  };

  // Handle left click on map (deselect / dropping markers / studio click selection)
  const handleClick = (e: maplibregl.MapMouseEvent) => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));

    if (e.defaultPrevented || isNavigating) {
      return;
    }

    if (appModeRef.current === 'studio') {
      const currentGraph = graphRef.current;
      if (!currentGraph) return;

      if (selectionToolRef.current === 'click') {
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ];
        let edgeId: string | null = null;
        const features =
          typeof map?.queryRenderedFeatures === 'function'
            ? map.queryRenderedFeatures(bbox, { layers: ['network-streets-layer'] })
            : [];

        if (
          features.length > 0 &&
          features[0]?.properties &&
          typeof features[0].properties.edgeId === 'string'
        ) {
          edgeId = features[0].properties.edgeId;
        } else {
          const nearest = findNearestEdge(currentGraph, { lat: e.lngLat.lat, lng: e.lngLat.lng });
          if (nearest && nearest.distance <= 30) {
            edgeId = `${nearest.uId}->${nearest.vId}`;
          }
        }

        if (edgeId) {
          const targetId = edgeId;
          setSelectedEdgeIds((prev) =>
            prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId],
          );
        }
      } else if (selectionToolRef.current === 'brush') {
        const coord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        const matching = findEdgesWithinRadius(currentGraph, coord, brushRadiusRef.current);
        if (matching.length > 0) {
          setSelectedEdgeIds((prev) => {
            const set = new Set(prev);
            for (const id of matching) set.add(id);
            return Array.from(set);
          });
        }
      }
      return;
    }

    setManagedClusterId(null);
    setManagedNodeIds([]);
    onNodeSelect(null);

    const sCoord = startCoordRef.current;
    const eCoord = endCoordRef.current;
    const clickedCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };

    // Once both pins are placed, do not re-add pins on click.
    // They must be dragged or set via context menu instead.
    if (sCoord && eCoord) {
      return;
    }

    if (!sCoord) {
      onStartDrag(clickedCoord);
      onEndDrag(null);
    } else {
      onEndDrag(clickedCoord);
    }
  };

  const handleDragStart = () => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setDockExpanded(false);
  };

  const handleZoomStart = () => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setDockExpanded(false);
  };

  // Initialize and retrieve map instance via custom hook
  const {
    map: mapInstance,
    mapContainerRef,
    mapReady: mapInstanceReady,
  } = useMapInstance({
    selectedPreset,
    theme,
    tileless,
    onMapBoundsChange,
    onContextMenu: handleContextMenu,
    onClick: handleClick,
    onDragStart: handleDragStart,
    onZoomStart: handleZoomStart,
  });

  // Synchronize internal map state with context
  useEffect(() => {
    setMap(mapInstance);
    setMapReady(mapInstanceReady);
  }, [mapInstance, mapInstanceReady, setMap, setMapReady]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainerRef} className="map-container" />

      {map && mapReady && (
        <>
          <StreetGraphLayer />
          <SelectedEdgesLayer />
          <BlockedEdgesLayer />
          <LandmarksLayer />
          <RouteVariantsLayer />
          <BBoxBoundaryLayer />
          <StartEndMarkers />
          <NavigationLayer />
          <InspectorLayer />
          <NodePopup key={selectedNode?.id} />
          <MapContextMenu />
          <MapLayerDock />
          <SelectionToolsDock />
        </>
      )}

      <NavigationHUD />
      <ArrivalPanel />
    </div>
  );
};

/**
 * Map container component that initializes the MapLibre GL instance,
 * handles map events, and mounts interactive layer overlays.
 */
export const MapView: React.FC<MapViewProps> = (props) => {
  return <MapViewContent onMapBoundsChange={props.onMapBoundsChange} tileless={props.tileless} />;
};
