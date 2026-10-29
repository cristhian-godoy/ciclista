import React, { useEffect } from 'react';

import { useAutoClusterCollapse } from '../hooks/useAutoClusterCollapse';
import { useMapCursor } from '../hooks/useMapCursor';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapInteractionController } from '../hooks/useMapInteractionController';
import { ArrivalPanel } from './ArrivalPanel';
import { MapPin } from './common/Icon';
import { Toast } from './common/Toast';
import { BlockedEdgesLayer } from './map/BlockedEdgesLayer';
import { BrushCircleLayer } from './map/BrushCircleLayer';
import { InspectorLayer } from './map/InspectorLayer';
import { CrossingEditorLayer } from './map/layers/CrossingEditorLayer';
import { type PlaceModalState, useMapContext } from './map/MapContext';
import { MapContextMenu } from './map/MapContextMenu';
import { MapLayerDock } from './map/MapLayerDock';
import { NavigationLayer } from './map/NavigationLayer';
import { NodePopup } from './map/NodePopup';
import { PlacesLayer } from './map/PlacesLayer';
import { RouteVariantsLayer } from './map/RouteVariantsLayer';
import { SelectedEdgesLayer } from './map/SelectedEdgesLayer';
import { SelectionToolsDock } from './map/SelectionToolsDock';
import { StartEndMarkers } from './map/StartEndMarkers';
import { StreetGraphLayer } from './map/StreetGraphLayer';
import { useMapInstance } from './map/useMapInstance';
import { NavigationHUD } from './NavigationHUD';
import { PlaceModal } from './PlaceModal';

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
    theme,
    managedClusterId,
    setManagedClusterId,
    managedNodeIds,
    setManagedNodeIds,
    selectedNode,
    startCoord,
    endCoord,
    graph,
    appMode,
    setSelectedEdgeIds,
    selectionTool,
    brushRadius,
    landmarkModal,
    placeModal,
    closeLandmarkModal,
    closePlaceModal,
    onCreateLandmark,
    onCreatePlace,
    onUpdateLandmark,
    onUpdatePlace,
    isPlacingPlace,
    setIsPlacingPlace,
    isPlacingStop,
    setIsPlacingStop,
    placingStopIndex,
    cancelPlacingStop,
    waypoints,
  } = useMapContext();

  const closePlace = closePlaceModal ?? closeLandmarkModal;
  const handleCreatePlace = onCreatePlace ?? onCreateLandmark;
  const handleUpdatePlace = onUpdatePlace ?? onUpdateLandmark;

  // Manage crosshair cursor and Escape key cancellation during pin placement
  useMapCursor({
    map,
    isPlacingPlace,
    setIsPlacingPlace,
    isPlacingStop,
    setIsPlacingStop,
    onCancelPlacingStop: cancelPlacingStop,
  });

  // Auto-collapse expanded crossing clusters on zoom out or far pan
  useAutoClusterCollapse({
    map,
    managedClusterId,
    managedNodeIds,
    graph,
    setManagedClusterId,
    setManagedNodeIds,
  });

  // Studio and events mode brush drag gestures
  useMapGestures({
    map,
    appMode,
    graph,
    selectionTool,
    brushRadius,
    setSelectedEdgeIds,
  });

  // Consolidated map click, contextmenu, drag start, and zoom start handlers
  const { handleClick, handleContextMenu, handleDragStart, handleZoomStart } =
    useMapInteractionController();

  // Initialize and retrieve map instance via custom hook
  const {
    map: mapInstance,
    mapContainerRef,
    mapReady: mapInstanceReady,
  } = useMapInstance({
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
    <div className={`map-wrapper ${isPlacingPlace ? 'map-pin-placement-mode' : ''}`.trim()}>
      <div ref={mapContainerRef} className="map-container" />

      {map && mapReady && (
        <>
          <StreetGraphLayer />
          <SelectedEdgesLayer />
          <BrushCircleLayer />
          <BlockedEdgesLayer />
          <PlacesLayer />
          <RouteVariantsLayer />
          <StartEndMarkers />
          <NavigationLayer />
          <InspectorLayer />
          <CrossingEditorLayer />
          <NodePopup key={selectedNode?.id} />
          <MapContextMenu />
          <MapLayerDock />
          <SelectionToolsDock />
        </>
      )}

      <NavigationHUD />
      <ArrivalPanel />
      {(() => {
        const activeModal: PlaceModalState = placeModal ??
          landmarkModal ?? {
            isOpen: false,
            landmark: null,
            initialCoordinates: null,
          };
        return (
          <PlaceModal
            isOpen={activeModal.isOpen}
            place={activeModal.landmark}
            initialCoordinates={activeModal.initialCoordinates}
            onClose={closePlace ?? (() => {})}
            onCreatePlace={handleCreatePlace}
            onUpdatePlace={handleUpdatePlace}
            currentMapCenter={
              map && typeof map.getCenter === 'function'
                ? { lat: map.getCenter().lat, lng: map.getCenter().lng }
                : (startCoord ?? endCoord ?? null)
            }
            startCoord={startCoord}
            endCoord={endCoord}
          />
        );
      })()}

      {/* Persistent toast notifying user to pick a location on the map */}
      {isPlacingPlace && (
        <Toast
          message="Click on the map to set place location"
          icon={<MapPin size={16} />}
          position="bottom-right"
          persistent
          onClose={() => setIsPlacingPlace?.(false)}
        />
      )}

      {/* Persistent toast notifying user to place or reposition route intermediate stop */}
      {isPlacingStop && (
        <Toast
          message={`Click on the map to place Stop ${
            typeof placingStopIndex === 'number' && placingStopIndex >= 0
              ? placingStopIndex + 1
              : (waypoints?.length ?? 0) + 1
          } (Esc to cancel)`}
          icon={<MapPin size={16} />}
          position="bottom-right"
          persistent
          onClose={() => (cancelPlacingStop ? cancelPlacingStop() : setIsPlacingStop?.(false))}
        />
      )}
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
