import * as maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
import { useSettings } from '../../store/settingsStore';
import { useMapContext } from './MapContext';

/**
 * Component that manages the lifecycle and positioning of the draggable
 * start (origin), destination, and intermediate waypoint pin markers on the map canvas.
 * Respects freezePinsOnEditMode setting and active mode to lock markers when appropriate.
 */
export const StartEndMarkers: React.FC = () => {
  const {
    map,
    startCoord,
    endCoord,
    waypoints = [],
    onStartDrag,
    onEndDrag,
    onUpdateWaypoint,
    setShouldFitBounds,
    isNavigating,
    appMode,
  } = useMapContext();
  const settings = useSettings();

  const isDraggable =
    !isNavigating &&
    (appMode === 'routing' || !appMode || (appMode === 'edit' && !settings.freezePinsOnEditMode));
  const isFrozen = !isDraggable;

  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endMarkerRef = useRef<maplibregl.Marker | null>(null);
  const waypointMarkersRef = useRef<maplibregl.Marker[]>([]);

  const onStartDragRef = useRef(onStartDrag);
  const onEndDragRef = useRef(onEndDrag);
  const onUpdateWaypointRef = useRef(onUpdateWaypoint);

  useEffect(() => {
    onStartDragRef.current = onStartDrag;
  }, [onStartDrag]);

  useEffect(() => {
    onEndDragRef.current = onEndDrag;
  }, [onEndDrag]);

  useEffect(() => {
    onUpdateWaypointRef.current = onUpdateWaypoint;
  }, [onUpdateWaypoint]);

  // Clean up all markers on unmount or map instance change
  useEffect(() => {
    return () => {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
        startMarkerRef.current = null;
      }
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
        endMarkerRef.current = null;
      }
      waypointMarkersRef.current.forEach((marker) => marker.remove());
      waypointMarkersRef.current = [];
    };
  }, [map]);

  // Synchronize draggable option and cursor style when mode, settings, or navigation status changes
  useEffect(() => {
    startMarkerRef.current?.setDraggable(isDraggable);
    endMarkerRef.current?.setDraggable(isDraggable);
    const startEl = startMarkerRef.current?.getElement?.();
    if (startEl) {
      startEl.style.cursor = isDraggable ? 'grab' : 'default';
      startEl.title =
        isFrozen && appMode === 'edit'
          ? 'Origin pin (frozen in Edit mode)'
          : 'Origin pin (draggable)';
    }
    const endEl = endMarkerRef.current?.getElement?.();
    if (endEl) {
      endEl.style.cursor = isDraggable ? 'grab' : 'default';
      endEl.title =
        isFrozen && appMode === 'edit'
          ? 'Destination pin (frozen in Edit mode)'
          : 'Destination pin (draggable)';
    }
    waypointMarkersRef.current.forEach((marker) => {
      marker.setDraggable(isDraggable);
      const wpEl = marker.getElement?.();
      if (wpEl) {
        wpEl.style.cursor = isDraggable ? 'grab' : 'default';
      }
    });
  }, [isDraggable, isFrozen, appMode]);

  // Dynamically manage Start Marker
  useEffect(() => {
    if (!map) return;
    if (startCoord) {
      if (!startMarkerRef.current) {
        const startEl = document.createElement('div');
        startEl.style.width = '28px';
        startEl.style.height = '28px';
        startEl.style.borderRadius = '50%';
        startEl.style.backgroundColor = MAP_THEME_TOKENS.status.success;
        startEl.style.border = `3px solid ${MAP_THEME_TOKENS.overlay.white}`;
        startEl.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.8)';
        startEl.style.cursor = isDraggable ? 'grab' : 'default';
        startEl.style.display = 'flex';
        startEl.style.alignItems = 'center';
        startEl.style.justifyContent = 'center';
        startEl.style.color = MAP_THEME_TOKENS.overlay.white;
        startEl.style.fontWeight = 'bold';
        startEl.style.fontSize = '12px';
        startEl.style.fontFamily = 'inherit';
        startEl.textContent = 'A';
        startEl.title =
          isFrozen && appMode === 'edit'
            ? 'Origin pin (frozen in Edit mode)'
            : 'Origin pin (draggable)';

        const startMarker = new maplibregl.Marker({ element: startEl, draggable: isDraggable })
          .setLngLat([startCoord.lng, startCoord.lat])
          .addTo(map);

        startMarker.on('dragend', () => {
          const lngLat = startMarker.getLngLat();
          onStartDragRef.current({ lat: lngLat.lat, lng: lngLat.lng });
        });
        startMarkerRef.current = startMarker;

        setShouldFitBounds(true);
      } else {
        const currentMarkerLngLat = startMarkerRef.current.getLngLat();
        const diffLat = Math.abs(startCoord.lat - currentMarkerLngLat.lat);
        const diffLng = Math.abs(startCoord.lng - currentMarkerLngLat.lng);
        startMarkerRef.current.setLngLat([startCoord.lng, startCoord.lat]);
        if (diffLat > 0.0001 || diffLng > 0.0001) {
          setShouldFitBounds(true);
        }
      }
    } else {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
        startMarkerRef.current = null;
      }
    }
  }, [map, startCoord, setShouldFitBounds, isDraggable, isFrozen, appMode]);

  // Dynamically manage End Marker
  useEffect(() => {
    if (!map) return;
    if (endCoord) {
      if (!endMarkerRef.current) {
        const endEl = document.createElement('div');
        endEl.style.width = '28px';
        endEl.style.height = '28px';
        endEl.style.borderRadius = '50%';
        endEl.style.backgroundColor = MAP_THEME_TOKENS.status.danger;
        endEl.style.border = `3px solid ${MAP_THEME_TOKENS.overlay.white}`;
        endEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.8)';
        endEl.style.cursor = isDraggable ? 'grab' : 'default';
        endEl.style.display = 'flex';
        endEl.style.alignItems = 'center';
        endEl.style.justifyContent = 'center';
        endEl.style.color = MAP_THEME_TOKENS.overlay.white;
        endEl.style.fontWeight = 'bold';
        endEl.style.fontSize = '12px';
        endEl.style.fontFamily = 'inherit';
        endEl.textContent = 'B';
        endEl.title =
          isFrozen && appMode === 'edit'
            ? 'Destination pin (frozen in Edit mode)'
            : 'Destination pin (draggable)';

        const endMarker = new maplibregl.Marker({ element: endEl, draggable: isDraggable })
          .setLngLat([endCoord.lng, endCoord.lat])
          .addTo(map);

        endMarker.on('dragend', () => {
          const lngLat = endMarker.getLngLat();
          onEndDragRef.current({ lat: lngLat.lat, lng: lngLat.lng });
        });
        endMarkerRef.current = endMarker;

        setShouldFitBounds(true);
      } else {
        const currentMarkerLngLat = endMarkerRef.current.getLngLat();
        const diffLat = Math.abs(endCoord.lat - currentMarkerLngLat.lat);
        const diffLng = Math.abs(endCoord.lng - currentMarkerLngLat.lng);
        endMarkerRef.current.setLngLat([endCoord.lng, endCoord.lat]);
        if (diffLat > 0.0001 || diffLng > 0.0001) {
          setShouldFitBounds(true);
        }
      }
    } else {
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
        endMarkerRef.current = null;
      }
    }
  }, [map, endCoord, setShouldFitBounds, isDraggable, isFrozen, appMode]);

  // Dynamically manage intermediate waypoint markers
  useEffect(() => {
    if (!map) return;

    const validWaypoints = waypoints.filter(
      (wp) =>
        wp &&
        typeof wp.lat === 'number' &&
        typeof wp.lng === 'number' &&
        !isNaN(wp.lat) &&
        !isNaN(wp.lng) &&
        (wp.lat !== 0 || wp.lng !== 0),
    );

    // Prune excess markers
    while (waypointMarkersRef.current.length > validWaypoints.length) {
      const removed = waypointMarkersRef.current.pop();
      removed?.remove();
    }

    let needsFitBounds = false;

    validWaypoints.forEach((wp, index) => {
      const existing = waypointMarkersRef.current[index];
      if (!existing) {
        const el = document.createElement('div');
        el.className = 'ciclista-waypoint-marker';
        el.dataset.index = String(index);
        el.style.width = '28px';
        el.style.height = '28px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = MAP_THEME_TOKENS.status.info;
        el.style.border = `3px solid ${MAP_THEME_TOKENS.overlay.white}`;
        el.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.8)';
        el.style.cursor = isDraggable ? 'grab' : 'default';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = MAP_THEME_TOKENS.overlay.white;
        el.style.fontWeight = 'bold';
        el.style.fontSize = '12px';
        el.style.fontFamily = 'inherit';
        el.textContent = `${index + 1}`;

        const marker = new maplibregl.Marker({ element: el, draggable: isDraggable })
          .setLngLat([wp.lng, wp.lat])
          .addTo(map);

        marker.on('dragend', () => {
          const currentIndex = parseInt(marker.getElement()?.dataset.index ?? String(index), 10);
          const lngLat = marker.getLngLat();
          onUpdateWaypointRef.current?.(currentIndex, { lat: lngLat.lat, lng: lngLat.lng });
        });

        waypointMarkersRef.current.push(marker);
        needsFitBounds = true;
      } else {
        const el = existing.getElement();
        if (el) {
          el.dataset.index = String(index);
          if (el.textContent !== `${index + 1}`) {
            el.textContent = `${index + 1}`;
          }
        }

        const currentMarkerLngLat = existing.getLngLat();
        const diffLat = Math.abs(wp.lat - currentMarkerLngLat.lat);
        const diffLng = Math.abs(wp.lng - currentMarkerLngLat.lng);
        existing.setLngLat([wp.lng, wp.lat]);
        if (diffLat > 0.0001 || diffLng > 0.0001) {
          needsFitBounds = true;
        }
      }
    });

    if (needsFitBounds) {
      setShouldFitBounds(true);
    }
  }, [map, waypoints, setShouldFitBounds, isDraggable]);

  return null;
};
