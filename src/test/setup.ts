import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Stub mock for maplibre-gl
vi.mock('maplibre-gl', () => {
  class LngLatBounds {
    _sw: [number, number];
    _ne: [number, number];
    constructor(sw: [number, number], ne?: [number, number]) {
      this._sw = sw;
      this._ne = ne || sw;
    }
    extend(lnglat: [number, number]) {
      this._sw = [Math.min(this._sw[0], lnglat[0]), Math.min(this._sw[1], lnglat[1])];
      this._ne = [Math.max(this._ne[0], lnglat[0]), Math.max(this._ne[1], lnglat[1])];
      return this;
    }
    getSouth() {
      return this._sw[1];
    }
    getWest() {
      return this._sw[0];
    }
    getNorth() {
      return this._ne[1];
    }
    getEast() {
      return this._ne[0];
    }
  }

  type Handler = (...args: unknown[]) => void;

  class Marker {
    element: HTMLElement | undefined;
    lngLat: [number, number] | undefined;
    draggable: boolean;
    events: Record<string, Handler[]> = {};

    constructor(options?: { element?: HTMLElement; draggable?: boolean }) {
      this.element = options?.element;
      this.draggable = options?.draggable || false;
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLat = lngLat;
      return this;
    }
    getLngLat() {
      return {
        lng: this.lngLat ? this.lngLat[0] : 0,
        lat: this.lngLat ? this.lngLat[1] : 0,
      };
    }
    addTo() {
      return this;
    }
    remove() {
      return this;
    }
    on(event: string, handler: Handler) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(handler);
      return this;
    }
    off(event: string, handler: Handler) {
      if (this.events[event]) {
        this.events[event] = this.events[event].filter((h) => h !== handler);
      }
      return this;
    }
  }

  class NavigationControl {}

  class Map {
    events: Record<string, Handler[]> = {};
    layerEvents: Record<string, Record<string, Handler[]>> = {};
    sources: Record<string, { data?: unknown; setData?: (data: unknown) => void }> = {};
    layers: Record<string, unknown> = {};
    options: unknown;

    constructor(options: unknown) {
      this.options = options;
      // Trigger load event asynchronously
      setTimeout(() => {
        this._trigger('load');
      }, 0);
    }

    addControl() {}
    removeControl() {}

    addSource(id: string, source: { type: string; data?: unknown }) {
      this.sources[id] = {
        ...source,
        setData: (data: unknown) => {
          if (this.sources[id]) {
            this.sources[id].data = data;
          }
        },
      };
    }
    getSource(id: string) {
      return this.sources[id];
    }
    removeSource(id: string) {
      delete this.sources[id];
    }

    addLayer(layer: { id: string }) {
      this.layers[layer.id] = layer;
    }
    getLayer(id: string) {
      return this.layers[id];
    }
    removeLayer(id: string) {
      delete this.layers[id];
    }

    moveLayer() {}
    setPaintProperty() {}
    setFilter() {}

    on(event: string, arg1: string | Handler, arg2?: Handler) {
      if (typeof arg1 === 'string' && typeof arg2 === 'function') {
        const layerId = arg1;
        const handler = arg2;
        if (!this.layerEvents[event]) {
          this.layerEvents[event] = {};
        }
        if (!this.layerEvents[event][layerId]) {
          this.layerEvents[event][layerId] = [];
        }
        this.layerEvents[event][layerId].push(handler);
      } else if (typeof arg1 === 'function') {
        const handler = arg1;
        if (!this.events[event]) {
          this.events[event] = [];
        }
        this.events[event].push(handler);
      }
    }

    off(event: string, arg1: string | Handler, arg2?: Handler) {
      if (typeof arg1 === 'string' && typeof arg2 === 'function') {
        const layerId = arg1;
        const handler = arg2;
        if (this.layerEvents[event] && this.layerEvents[event][layerId]) {
          this.layerEvents[event][layerId] = this.layerEvents[event][layerId].filter(
            (h) => h !== handler,
          );
        }
      } else if (typeof arg1 === 'function') {
        const handler = arg1;
        if (this.events[event]) {
          this.events[event] = this.events[event].filter((h) => h !== handler);
        }
      }
    }

    _trigger(event: string, ...args: unknown[]) {
      if (this.events[event]) {
        this.events[event].forEach((handler) => {
          handler(...args);
        });
      }
    }

    fitBounds() {}
    easeTo() {}
    project() {
      return { x: 100, y: 200 };
    }
    getBounds() {
      return {
        getSouth: () => 48.0,
        getWest: () => 11.0,
        getNorth: () => 49.0,
        getEast: () => 12.0,
      };
    }
    getZoom() {
      return 14.5;
    }
    getCanvas() {
      return {
        style: {},
      };
    }
    remove() {}
    queryRenderedFeatures() {
      return [];
    }
  }

  return {
    Map,
    Marker,
    LngLatBounds,
    NavigationControl,
    default: {
      Map,
      Marker,
      LngLatBounds,
      NavigationControl,
    },
  };
});
