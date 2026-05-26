import type maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

import type { Coordinate } from '../core/common/types';
import type { GraphNode, StreetGraph } from '../core/graph/types';
import type { RouteAlternative } from '../core/router/types';
import { BBoxBoundaryLayer } from './map/BBoxBoundaryLayer';
import { MapProvider, useMapContext } from './map/MapContext';
import { MapContextMenu } from './map/MapContextMenu';
import { MapLayerDock } from './map/MapLayerDock';
import { NodePopup } from './map/NodePopup';
import { RouteAlternativesLayer } from './map/RouteAlternativesLayer';
import { StartEndMarkers } from './map/StartEndMarkers';
import { StreetGraphLayer } from './map/StreetGraphLayer';
import { useMapInstance } from './map/useMapInstance';

interface MapViewProps {
  graph: StreetGraph | null;
  loadedBBoxes: [number, number, number, number][];
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeAlternatives: RouteAlternative[];
  activeAlternativeLabel: 'standard' | 'avoid-stops' | 'quiet-streets';
  onSelectAlternative: (label: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  customNodeDelays: Map<string, number>;
  customNodeNotes: Map<string, string>;
  selectedNode: GraphNode | null;
  onStartDrag: (coord: Coordinate | null) => void;
  onEndDrag: (coord: Coordinate | null) => void;
  onNodeSelect: (node: GraphNode | null) => void;
  onSaveNodeOverride: (nodeId: string, delay: number, notes: string) => void;
  onClearNodeOverride: (nodeId: string) => void;
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
  theme: 'bright' | 'liberty' | 'dark';
}

const MapViewContent: React.FC<{
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
}> = ({ onMapBoundsChange }) => {
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
  } = useMapContext();

  const startCoordRef = useRef(startCoord);
  const endCoordRef = useRef(endCoord);

  // Keep coord refs synchronized for event handlers
  useEffect(() => {
    startCoordRef.current = startCoord;
    endCoordRef.current = endCoord;
  }, [startCoord, endCoord]);

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

  // Handle right click on map (context menu trigger)
  const handleContextMenu = (e: maplibregl.MapMouseEvent) => {
    if (!map) return;
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

  // Handle left click on map (deselect / dropping markers)
  const handleClick = (e: maplibregl.MapMouseEvent) => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));

    if (e.defaultPrevented) {
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
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={mapContainerRef} className="map-container" />

      {map && mapReady && (
        <>
          <StreetGraphLayer />
          <RouteAlternativesLayer />
          <BBoxBoundaryLayer />
          <StartEndMarkers />
          <NodePopup key={selectedNode?.id} />
          <MapContextMenu />
          <MapLayerDock />
        </>
      )}
    </div>
  );
};

/**
 * Map container component that initializes the MapLibre GL instance,
 * handles map events, and mounts interactive layer overlays.
 */
export const MapView: React.FC<MapViewProps> = (props) => {
  return (
    <MapProvider {...props}>
      <MapViewContent onMapBoundsChange={props.onMapBoundsChange} />
    </MapProvider>
  );
};
