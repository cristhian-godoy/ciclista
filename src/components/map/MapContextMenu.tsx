import { Edit2, MapPin, Star, Trash2, ZoomIn } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import { useMapContext } from './MapContext';

/**
 * Interactive floating context menu triggered by right-clicking on the map canvas.
 * Provides quick actions to set the start (origin) or end (destination) navigation pins
 * or manage places and traffic light clusters.
 */
export const MapContextMenu: React.FC = () => {
  const {
    map,
    contextMenu,
    setContextMenu,
    setManagedClusterId,
    setManagedNodeIds,
    onStartDrag,
    onEndDrag,
    isNavigating,
    openCreatePlaceModal,
    openCreateLandmarkModal,
    openEditPlaceModal,
    openEditLandmarkModal,
    onDeletePlace,
    onDeleteLandmark,
    places,
    landmarks,
  } = useMapContext();

  const onStartDragRef = useRef(onStartDrag);
  const onEndDragRef = useRef(onEndDrag);
  const setManagedClusterIdRef = useRef(setManagedClusterId);
  const setManagedNodeIdsRef = useRef(setManagedNodeIds);

  useEffect(() => {
    onStartDragRef.current = onStartDrag;
  }, [onStartDrag]);

  useEffect(() => {
    onEndDragRef.current = onEndDrag;
  }, [onEndDrag]);

  useEffect(() => {
    setManagedClusterIdRef.current = setManagedClusterId;
  }, [setManagedClusterId]);

  useEffect(() => {
    setManagedNodeIdsRef.current = setManagedNodeIds;
  }, [setManagedNodeIds]);

  if (!map || !contextMenu.visible) return null;

  const currentPlaces = places ?? landmarks ?? [];
  const targetPlace = contextMenu.placeId
    ? currentPlaces.find((p) => p.id === contextMenu.placeId)
    : null;

  return (
    <div
      className="map-context-menu"
      /* eslint-disable-next-line react/forbid-dom-props -- Dynamic spatial screen coordinates of context menu position calculated at mouse click location */
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {targetPlace ? (
        <>
          <button
            type="button"
            className="map-context-menu-item"
            onClick={() => {
              const editModalFn = openEditPlaceModal ?? openEditLandmarkModal;
              editModalFn?.(targetPlace);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <Edit2 size={14} className="context-icon-place" />
            <span>Edit Place</span>
          </button>
          {!isNavigating && (
            <>
              <button
                type="button"
                className="map-context-menu-item"
                onClick={() => {
                  if (onStartDragRef.current) {
                    onStartDragRef.current({ lat: targetPlace.lat, lng: targetPlace.lng });
                  }
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <MapPin size={14} className="context-icon-success" />
                <span>Set as Start</span>
              </button>
              <button
                type="button"
                className="map-context-menu-item"
                onClick={() => {
                  if (onEndDragRef.current) {
                    onEndDragRef.current({ lat: targetPlace.lat, lng: targetPlace.lng });
                  }
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <MapPin size={14} className="context-icon-danger" />
                <span>Set as Destination</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="map-context-menu-item map-context-menu-item--danger"
            onClick={() => {
              const deleteFn = onDeletePlace ?? onDeleteLandmark;
              deleteFn?.(targetPlace.id);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <Trash2 size={14} className="context-icon-danger" />
            <span>Delete Place</span>
          </button>
        </>
      ) : (
        <>
          {contextMenu.crossingId !== null && (
            <button
              type="button"
              className="map-context-menu-item"
              onClick={() => {
                if (contextMenu.crossingId !== null) {
                  const nodeIds = JSON.parse(contextMenu.nodeIds || '[]');
                  if (setManagedClusterIdRef.current) {
                    setManagedClusterIdRef.current(contextMenu.crossingId);
                  }
                  if (setManagedNodeIdsRef.current) {
                    setManagedNodeIdsRef.current(nodeIds);
                  }

                  map.easeTo({
                    center: [contextMenu.lng, contextMenu.lat],
                    zoom: 17.5,
                  });
                }
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
            >
              <ZoomIn size={14} className="context-icon-warn" />
              <span>Manage Traffic Lights</span>
            </button>
          )}
          {!isNavigating && (
            <>
              <button
                type="button"
                className="map-context-menu-item"
                onClick={() => {
                  if (onStartDragRef.current) {
                    onStartDragRef.current({ lat: contextMenu.lat, lng: contextMenu.lng });
                  }
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <MapPin size={14} className="context-icon-success" />
                <span>Start Route Here</span>
              </button>
              <button
                type="button"
                className="map-context-menu-item"
                onClick={() => {
                  if (onEndDragRef.current) {
                    onEndDragRef.current({ lat: contextMenu.lat, lng: contextMenu.lng });
                  }
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <MapPin size={14} className="context-icon-danger" />
                <span>End Route Here</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="map-context-menu-item"
            onClick={() => {
              const createModalFn = openCreatePlaceModal ?? openCreateLandmarkModal;
              createModalFn?.({ lat: contextMenu.lat, lng: contextMenu.lng });
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <Star size={14} className="context-icon-place context-icon-favorite" />
            <span>Add Place</span>
          </button>
        </>
      )}
    </div>
  );
};
