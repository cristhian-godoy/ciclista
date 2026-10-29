import React, { useEffect, useLayoutEffect, useRef } from 'react';

import { Edit2, MapPin, Star, Trash2, ZoomIn } from '../common/Icon';
import { useMapContext } from './MapContext';

/**
 * Safely parses raw JSON serialized node identifiers into a string array.
 *
 * @param raw - JSON string containing serialized node IDs.
 * @returns Array of parsed node ID strings.
 */
function parseNodeIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
    return [];
  } catch {
    return [];
  }
}

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
    appMode,
    openCreatePlaceModal,
    openCreateLandmarkModal,
    openEditPlaceModal,
    openEditLandmarkModal,
    onDeletePlace,
    onDeleteLandmark,
    places,
    landmarks,
  } = useMapContext();

  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (menuRef.current) {
      menuRef.current.style.left = `${contextMenu.x}px`;
      menuRef.current.style.top = `${contextMenu.y}px`;
    }
  }, [contextMenu.x, contextMenu.y]);

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

  // Universal Escape key dismissal contract
  useEffect(() => {
    if (!contextMenu.visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.visible, setContextMenu]);

  if (!map || !contextMenu.visible) return null;

  const canRoute = !isNavigating && (appMode === 'routing' || !appMode);
  const isSpecializedMode =
    appMode === 'edit' || appMode === 'events' || (appMode as string) === 'studio';
  const canManagePlaces = !isSpecializedMode;
  const canManageCrossing = contextMenu.crossingId !== null;

  const currentPlaces = places ?? landmarks ?? [];
  const targetPlace = contextMenu.placeId
    ? currentPlaces.find((p) => p.id === contextMenu.placeId)
    : null;

  if (targetPlace) {
    if (!canManagePlaces && !canRoute) {
      return null;
    }

    return (
      <div ref={menuRef} className="map-context-menu" onClick={(e) => e.stopPropagation()}>
        {canManagePlaces && (
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
        )}
        {canRoute && (
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
        {canManagePlaces && (
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
        )}
      </div>
    );
  }

  if (!canManageCrossing && !canRoute && !canManagePlaces) {
    return null;
  }

  return (
    <div ref={menuRef} className="map-context-menu" onClick={(e) => e.stopPropagation()}>
      {canManageCrossing && (
        <button
          type="button"
          className="map-context-menu-item"
          onClick={() => {
            if (contextMenu.crossingId !== null) {
              const nodeIds = parseNodeIds(contextMenu.nodeIds);
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
      {canRoute && (
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
      {canManagePlaces && (
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
      )}
    </div>
  );
};
