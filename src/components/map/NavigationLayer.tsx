import React, { useEffect, useMemo, useRef } from 'react';

import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { useMapContext } from './MapContext';

/**
 * Creates an HTML Canvas displaying a custom navigation chevron pointing North.
 */
function createArrowImage(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#6366f1';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(24, 6);
  ctx.lineTo(40, 38);
  ctx.lineTo(24, 28);
  ctx.lineTo(8, 38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return canvas;
}

/**
 * Map overlay layer managing rendering of the rider snapped position marker
 * and debounced camera easing controls.
 */
export const NavigationLayer: React.FC = () => {
  const { map, navigationState, isNavigating } = useMapContext();
  const lastCameraUpdateRef = useRef<number>(0);
  const isDev = import.meta.env.DEV;

  // Initialize and tear down navigation arrow image
  useEffect(() => {
    if (!map) return;

    if (!map.hasImage('nav-arrow')) {
      const canvas = createArrowImage();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        map.addImage('nav-arrow', ctx.getImageData(0, 0, 48, 48));
      }
    }

    return () => {
      if (map.hasImage('nav-arrow')) {
        map.removeImage('nav-arrow');
      }
    };
  }, [map]);

  const navPositionLayer = useMemo<GeoJsonLayerSpec>(
    () => ({
      id: 'nav-position-layer',
      type: 'symbol',
      source: 'nav-position',
      layout: {
        'icon-image': 'nav-arrow',
        'icon-size': 0.7,
        'icon-rotate': ['coalesce', ['get', 'bearing'], 0],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        visibility: isNavigating ? 'visible' : 'none',
      },
    }),
    [isNavigating],
  );

  const rawPositionLayer = useMemo<GeoJsonLayerSpec>(
    () => ({
      id: 'nav-raw-position-layer',
      type: 'circle',
      source: 'nav-raw-position',
      paint: {
        'circle-radius': 6,
        'circle-color': '#f43f5e',
        'circle-opacity': 0.8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
      layout: {
        visibility: isNavigating && isDev ? 'visible' : 'none',
      },
    }),
    [isNavigating, isDev],
  );

  const snappedGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    if (isNavigating && navigationState.snapped) {
      const { coordinate, bearing } = navigationState.snapped;
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [coordinate.lng, coordinate.lat],
            },
            properties: { bearing },
          },
        ],
      };
    }
    return { type: 'FeatureCollection', features: [] };
  }, [isNavigating, navigationState.snapped]);

  const rawGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    if (isNavigating && isDev && navigationState.raw) {
      const rawCoord = navigationState.raw;
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [rawCoord.lng, rawCoord.lat],
            },
            properties: {},
          },
        ],
      };
    }
    return { type: 'FeatureCollection', features: [] };
  }, [isNavigating, isDev, navigationState.raw]);

  useGeoJsonLayer({
    map,
    sourceId: 'nav-position',
    layer: navPositionLayer,
    data: snappedGeoJSON,
  });

  useGeoJsonLayer({
    map: isDev ? map : null,
    sourceId: 'nav-raw-position',
    layer: rawPositionLayer,
    data: rawGeoJSON,
  });

  // Trigger camera updates debounced to 250ms to prevent jittering
  useEffect(() => {
    if (!map || !isNavigating || !navigationState.snapped) return;

    const now = performance.now();
    if (now - lastCameraUpdateRef.current < 250) {
      return;
    }
    lastCameraUpdateRef.current = now;

    const { coordinate, bearing } = navigationState.snapped;
    const { cameraMode } = navigationState;

    if (cameraMode === 'heading-up') {
      map.easeTo({
        center: [coordinate.lng, coordinate.lat],
        bearing: bearing,
        zoom: 17,
        pitch: 45,
        duration: 300,
      });
    } else {
      map.easeTo({
        center: [coordinate.lng, coordinate.lat],
        bearing: 0,
        zoom: 16,
        pitch: 0,
        duration: 300,
      });
    }
  }, [map, isNavigating, navigationState, navigationState.snapped, navigationState.cameraMode]);

  return null;
};
