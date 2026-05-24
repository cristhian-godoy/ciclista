import React, { useRef, useState, useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import type { Coordinate } from '../core/common/types';
import type { StreetGraph, GraphNode } from '../core/graph/types';
import type { RouteAlternative } from '../core/router/types';
import { useMapInstance } from './map/useMapInstance';
import { StreetGraphLayer } from './map/StreetGraphLayer';
import { RouteAlternativesLayer } from './map/RouteAlternativesLayer';
import { BBoxBoundaryLayer } from './map/BBoxBoundaryLayer';
import { StartEndMarkers } from './map/StartEndMarkers';
import { NodePopup } from './map/NodePopup';
import { MapContextMenu } from './map/MapContextMenu';
import { MapLayerDock } from './map/MapLayerDock';

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

export const MapView: React.FC<MapViewProps> = ({
  graph,
  loadedBBoxes,
  startCoord,
  endCoord,
  routeAlternatives,
  activeAlternativeLabel,
  onSelectAlternative,
  selectedPreset,
  customNodeDelays,
  customNodeNotes,
  selectedNode,
  onStartDrag,
  onEndDrag,
  onNodeSelect,
  onSaveNodeOverride,
  onClearNodeOverride,
  onMapBoundsChange,
  theme,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    lng: number;
    lat: number;
    crossingId: string | null;
    nodeIds: string | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    lng: 0,
    lat: 0,
    crossingId: null,
    nodeIds: null,
  });

  const [managedClusterId, setManagedClusterId] = useState<string | null>(null);
  const [managedNodeIds, setManagedNodeIds] = useState<string[]>([]);
  const [showMinorControls, setShowMinorControls] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(true);

  const shouldFitBoundsRef = useRef<boolean>(true);
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
  }, []);

  // Reset managed cluster state if selectedNode becomes null
  const prevSelectedNodeRef = useRef<GraphNode | null>(null);
  useEffect(() => {
    if (prevSelectedNodeRef.current !== null && selectedNode === null) {
      setManagedClusterId(null);
      setManagedNodeIds([]);
    }
    prevSelectedNodeRef.current = selectedNode;
  }, [selectedNode]);

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

    if (!map) return;
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['traffic-lights-cluster', 'traffic-lights-unclustered'],
    });
    if (features.length === 0) {
      setManagedClusterId(null);
      setManagedNodeIds([]);
      onNodeSelect(null);

      const sCoord = startCoordRef.current;
      const eCoord = endCoordRef.current;
      const clickedCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };

      if (!sCoord || (sCoord && eCoord)) {
        onStartDrag(clickedCoord);
        onEndDrag(null);
      } else {
        onEndDrag(clickedCoord);
      }
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
  const { map, mapContainerRef, mapReady } = useMapInstance({
    selectedPreset,
    theme,
    onMapBoundsChange,
    onContextMenu: handleContextMenu,
    onClick: handleClick,
    onDragStart: handleDragStart,
    onZoomStart: handleZoomStart,
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={mapContainerRef} className="map-container" />

      {map && mapReady && (
        <>
          <StreetGraphLayer
            map={map}
            graph={graph}
            customNodeDelays={customNodeDelays}
            showMinorControls={showMinorControls}
            managedClusterId={managedClusterId}
            managedNodeIds={managedNodeIds}
            setManagedClusterId={setManagedClusterId}
            setManagedNodeIds={setManagedNodeIds}
            onNodeSelect={onNodeSelect}
          />
          <RouteAlternativesLayer
            map={map}
            routeAlternatives={routeAlternatives}
            activeAlternativeLabel={activeAlternativeLabel}
            onSelectAlternative={onSelectAlternative}
            shouldFitBoundsRef={shouldFitBoundsRef}
          />
          <BBoxBoundaryLayer map={map} loadedBBoxes={loadedBBoxes} />
          <StartEndMarkers
            map={map}
            startCoord={startCoord}
            endCoord={endCoord}
            onStartDrag={onStartDrag}
            onEndDrag={onEndDrag}
            shouldFitBoundsRef={shouldFitBoundsRef}
          />
          <NodePopup
            key={selectedNode?.id}
            map={map}
            selectedNode={selectedNode}
            onNodeSelect={onNodeSelect}
            customNodeDelays={customNodeDelays}
            customNodeNotes={customNodeNotes}
            onSaveNodeOverride={onSaveNodeOverride}
            onClearNodeOverride={onClearNodeOverride}
            setDockExpanded={setDockExpanded}
          />
          <MapContextMenu
            map={map}
            contextMenu={contextMenu}
            setContextMenu={setContextMenu}
            setManagedClusterId={setManagedClusterId}
            setManagedNodeIds={setManagedNodeIds}
            onStartDrag={onStartDrag}
            onEndDrag={onEndDrag}
          />
          <MapLayerDock
            showMinorControls={showMinorControls}
            setShowMinorControls={setShowMinorControls}
            dockExpanded={dockExpanded}
            setDockExpanded={setDockExpanded}
          />
        </>
      )}
    </div>
  );
};
