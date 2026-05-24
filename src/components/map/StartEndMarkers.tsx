import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

import type { Coordinate } from '../../core/common/types';

interface StartEndMarkersProps {
  map: maplibregl.Map;
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  onStartDrag: (coord: Coordinate | null) => void;
  onEndDrag: (coord: Coordinate | null) => void;
  shouldFitBoundsRef: React.RefObject<boolean>;
}

/**
 *
 */
export const StartEndMarkers: React.FC<StartEndMarkersProps> = ({
  map,
  startCoord,
  endCoord,
  onStartDrag,
  onEndDrag,
  shouldFitBoundsRef,
}) => {
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

  // Clean up all markers on unmount
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
  }, []);

  // Dynamically manage Start Marker
  useEffect(() => {
    if (startCoord) {
      if (!startMarkerRef.current) {
        const startEl = document.createElement('div');
        startEl.style.width = '28px';
        startEl.style.height = '28px';
        startEl.style.borderRadius = '50%';
        startEl.style.backgroundColor = '#10b981'; // Emerald Green
        startEl.style.border = '3px solid #ffffff';
        startEl.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.8)';
        startEl.style.cursor = 'grab';
        startEl.style.display = 'flex';
        startEl.style.alignItems = 'center';
        startEl.style.justifyContent = 'center';
        startEl.style.color = '#ffffff';
        startEl.style.fontWeight = 'bold';
        startEl.style.fontSize = '12px';
        startEl.style.fontFamily = 'inherit';
        startEl.innerHTML = 'A';

        const startMarker = new maplibregl.Marker({ element: startEl, draggable: true })
          .setLngLat([startCoord.lng, startCoord.lat])
          .addTo(map);

        startMarker.on('dragend', () => {
          const lngLat = startMarker.getLngLat();
          onStartDragRef.current({ lat: lngLat.lat, lng: lngLat.lng });
        });
        startMarkerRef.current = startMarker;

        if (shouldFitBoundsRef.current !== null) {
          (shouldFitBoundsRef as React.MutableRefObject<boolean>).current = true;
        }
      } else {
        const currentMarkerLngLat = startMarkerRef.current.getLngLat();
        const diffLat = Math.abs(startCoord.lat - currentMarkerLngLat.lat);
        const diffLng = Math.abs(startCoord.lng - currentMarkerLngLat.lng);
        startMarkerRef.current.setLngLat([startCoord.lng, startCoord.lat]);
        if (diffLat > 0.0001 || diffLng > 0.0001) {
          if (shouldFitBoundsRef.current !== null) {
            (shouldFitBoundsRef as React.MutableRefObject<boolean>).current = true;
          }
        }
      }
    } else {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
        startMarkerRef.current = null;
      }
    }
  }, [map, startCoord, shouldFitBoundsRef]);

  // Dynamically manage End Marker
  useEffect(() => {
    if (endCoord) {
      if (!endMarkerRef.current) {
        const endEl = document.createElement('div');
        endEl.style.width = '28px';
        endEl.style.height = '28px';
        endEl.style.borderRadius = '50%';
        endEl.style.backgroundColor = '#ef4444'; // Red
        endEl.style.border = '3px solid #ffffff';
        endEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.8)';
        endEl.style.cursor = 'grab';
        endEl.style.display = 'flex';
        endEl.style.alignItems = 'center';
        endEl.style.justifyContent = 'center';
        endEl.style.color = '#ffffff';
        endEl.style.fontWeight = 'bold';
        endEl.style.fontSize = '12px';
        endEl.style.fontFamily = 'inherit';
        endEl.innerHTML = 'B';

        const endMarker = new maplibregl.Marker({ element: endEl, draggable: true })
          .setLngLat([endCoord.lng, endCoord.lat])
          .addTo(map);

        endMarker.on('dragend', () => {
          const lngLat = endMarker.getLngLat();
          onEndDragRef.current({ lat: lngLat.lat, lng: lngLat.lng });
        });
        endMarkerRef.current = endMarker;

        if (shouldFitBoundsRef.current !== null) {
          (shouldFitBoundsRef as React.MutableRefObject<boolean>).current = true;
        }
      } else {
        const currentMarkerLngLat = endMarkerRef.current.getLngLat();
        const diffLat = Math.abs(endCoord.lat - currentMarkerLngLat.lat);
        const diffLng = Math.abs(endCoord.lng - currentMarkerLngLat.lng);
        endMarkerRef.current.setLngLat([endCoord.lng, endCoord.lat]);
        if (diffLat > 0.0001 || diffLng > 0.0001) {
          if (shouldFitBoundsRef.current !== null) {
            (shouldFitBoundsRef as React.MutableRefObject<boolean>).current = true;
          }
        }
      }
    } else {
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
        endMarkerRef.current = null;
      }
    }
  }, [map, endCoord, shouldFitBoundsRef]);

  return null;
};
