import * as maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
import { useSettings } from '../../store/settingsStore';
import { useMapContext } from './MapContext';

/**
 * Component that manages the lifecycle and positioning of the draggable
 * start (origin) and end (destination) pin markers on the map canvas.
 * Respects freezePinsOnEditMode setting to lock markers during edit mode.
 */
export const StartEndMarkers: React.FC = () => {
  const {
    map,
    startCoord,
    endCoord,
    onStartDrag,
    onEndDrag,
    setShouldFitBounds,
    isNavigating,
    appMode,
  } = useMapContext();
  const settings = useSettings();

  const isFrozen = Boolean((appMode === 'edit' && settings.freezePinsOnEditMode) || isNavigating);

  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endMarkerRef = useRef<maplibregl.Marker | null>(null);

  const onStartDragRef = useRef(onStartDrag);
  const onEndDragRef = useRef(onEndDrag);

  useEffect(() => {
    onStartDragRef.current = onStartDrag;
  }, [onStartDrag]);

  useEffect(() => {
    onEndDragRef.current = onEndDrag;
  }, [onEndDrag]);

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
    };
  }, [map]);

  // Synchronize draggable and cursor options when frozen state changes
  useEffect(() => {
    const draggable = !isFrozen;
    startMarkerRef.current?.setDraggable(draggable);
    endMarkerRef.current?.setDraggable(draggable);

    if (startMarkerRef.current) {
      const el = startMarkerRef.current.getElement();
      if (el) {
        el.style.cursor = draggable ? 'grab' : 'default';
        el.title =
          isFrozen && appMode === 'edit'
            ? 'Origin pin (frozen in Edit mode)'
            : 'Origin pin (draggable)';
      }
    }

    if (endMarkerRef.current) {
      const el = endMarkerRef.current.getElement();
      if (el) {
        el.style.cursor = draggable ? 'grab' : 'default';
        el.title =
          isFrozen && appMode === 'edit'
            ? 'Destination pin (frozen in Edit mode)'
            : 'Destination pin (draggable)';
      }
    }
  }, [isFrozen, appMode]);

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
        startEl.style.cursor = !isFrozen ? 'grab' : 'default';
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

        const startMarker = new maplibregl.Marker({ element: startEl, draggable: !isFrozen })
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
  }, [map, startCoord, setShouldFitBounds, isFrozen, appMode]);

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
        endEl.style.cursor = !isFrozen ? 'grab' : 'default';
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

        const endMarker = new maplibregl.Marker({ element: endEl, draggable: !isFrozen })
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
  }, [map, endCoord, setShouldFitBounds, isFrozen, appMode]);

  return null;
};
