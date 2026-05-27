import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

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

  // Initialize source, layer, and images
  useEffect(() => {
    if (!map) return;

    if (!map.hasImage('nav-arrow')) {
      const canvas = createArrowImage();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        map.addImage('nav-arrow', ctx.getImageData(0, 0, 48, 48));
      }
    }

    if (!map.getSource('nav-position')) {
      map.addSource('nav-position', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer('nav-position-layer')) {
      map.addLayer({
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
        },
      });
    }

    if (isDev) {
      if (!map.getSource('nav-raw-position')) {
        map.addSource('nav-raw-position', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }

      if (!map.getLayer('nav-raw-position-layer')) {
        map.addLayer({
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
        });
      }
    }

    return () => {
      if (map.getLayer('nav-position-layer')) {
        map.removeLayer('nav-position-layer');
      }
      if (map.getSource('nav-position')) {
        map.removeSource('nav-position');
      }
      if (map.getLayer('nav-raw-position-layer')) {
        map.removeLayer('nav-raw-position-layer');
      }
      if (map.getSource('nav-raw-position')) {
        map.removeSource('nav-raw-position');
      }
      if (map.hasImage('nav-arrow')) {
        map.removeImage('nav-arrow');
      }
    };
  }, [map, isDev]);

  // Synchronize visibility state
  useEffect(() => {
    if (!map) return;
    const layer = map.getLayer('nav-position-layer');
    if (layer) {
      map.setLayoutProperty('nav-position-layer', 'visibility', isNavigating ? 'visible' : 'none');
    }
    const rawLayer = map.getLayer('nav-raw-position-layer');
    if (rawLayer) {
      map.setLayoutProperty(
        'nav-raw-position-layer',
        'visibility',
        isNavigating && isDev ? 'visible' : 'none',
      );
    }
  }, [map, isNavigating, isDev]);

  // Synchronize GeoJSON snapped & raw coordinates and properties
  useEffect(() => {
    if (!map) return;
    const source = map.getSource('nav-position') as maplibregl.GeoJSONSource;
    const rawSource = map.getSource('nav-raw-position') as maplibregl.GeoJSONSource;

    if (isNavigating && navigationState.snapped) {
      const { coordinate, bearing } = navigationState.snapped;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [coordinate.lng, coordinate.lat],
              },
              properties: {
                bearing,
              },
            },
          ],
        });
      }
    } else {
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }

    if (isNavigating && isDev && navigationState.raw) {
      const rawCoord = navigationState.raw;
      if (rawSource) {
        rawSource.setData({
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
        });
      }
    } else {
      if (rawSource) {
        rawSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }
  }, [map, isNavigating, isDev, navigationState.snapped, navigationState.raw]);

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
