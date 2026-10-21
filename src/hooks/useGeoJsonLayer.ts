import type * as maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Layer specification type supported by useGeoJsonLayer.
 */
export type GeoJsonLayerSpec = maplibregl.LayerSpecification & {
  beforeId?: string;
};

/**
 * Configuration options for the useGeoJsonLayer hook.
 */
export interface UseGeoJsonLayerOptions {
  /** MapLibre map instance, or null if map is uninitialized */
  map: maplibregl.Map | null;
  /** Unique identifier for the GeoJSON source */
  sourceId: string;
  /** Layer specification or array of layer specifications attached to this source */
  layer?: GeoJsonLayerSpec | GeoJsonLayerSpec[];
  /** Alias for multiple layer specifications attached to this source */
  layers?: GeoJsonLayerSpec[];
  /** Optional GeoJSON source configurations such as clustering or max zoom */
  sourceOptions?: Partial<Omit<maplibregl.GeoJSONSourceSpecification, 'type' | 'data'>>;
  /** Optional layer ID before which to insert the newly created layers */
  beforeId?: string;
  /** GeoJSON data to synchronize into the source */
  data?: GeoJSON.GeoJSON | null;
}

/**
 * Return interface for imperative operations on the managed GeoJSON layer.
 */
export interface UseGeoJsonLayerReturn {
  /** Retrieves the active GeoJSONSource instance from the map */
  getSource: () => maplibregl.GeoJSONSource | null;
  /** Imperatively updates the source GeoJSON data */
  setData: (data: GeoJSON.GeoJSON) => void;
}

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Custom React hook that unifies imperative MapLibre GL GeoJSON source and layer lifecycle.
 * Manages source registration, layer registration, teardown on unmount, and reactive setData updates.
 *
 * @param options - Configuration options for map, sourceId, layers, and data.
 * @returns Imperative accessors to the underlying source.
 */
export function useGeoJsonLayer({
  map,
  sourceId,
  layer,
  layers,
  sourceOptions,
  beforeId,
  data,
}: UseGeoJsonLayerOptions): UseGeoJsonLayerReturn {
  const lastPaintPropsRef = useRef<Map<string, Map<string, unknown>>>(new Map());
  const lastLayoutPropsRef = useRef<Map<string, Map<string, unknown>>>(new Map());

  const getSource = useCallback(() => {
    if (!map) return null;
    return (map.getSource(sourceId) as maplibregl.GeoJSONSource) ?? null;
  }, [map, sourceId]);

  const setData = useCallback(
    (nextData: GeoJSON.GeoJSON) => {
      const source = getSource();
      if (source && typeof source.setData === 'function') {
        source.setData(nextData);
      }
    },
    [getSource],
  );

  // 1. Source and Layer registration & teardown
  useEffect(() => {
    if (!map) return;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
        ...sourceOptions,
      });
    }

    const layerList = layers ?? (layer ? (Array.isArray(layer) ? layer : [layer]) : []);
    for (const l of layerList) {
      if (!map.getLayer(l.id)) {
        const targetBeforeId = l.beforeId ?? beforeId;
        if (targetBeforeId !== undefined) {
          map.addLayer(l, targetBeforeId);
        } else {
          map.addLayer(l);
        }
      }
    }

    const lastPaintProps = lastPaintPropsRef.current;
    const lastLayoutProps = lastLayoutPropsRef.current;

    return () => {
      for (const l of layerList) {
        if (map.getLayer(l.id)) {
          map.removeLayer(l.id);
        }
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      lastPaintProps.delete(sourceId);
      lastLayoutProps.delete(sourceId);
    };
  }, [map, sourceId, beforeId, layer, layers, sourceOptions]);

  // 2. Dynamic paint and layout property synchronization
  useEffect(() => {
    if (!map) return;
    const layerList = layers ?? (layer ? (Array.isArray(layer) ? layer : [layer]) : []);

    for (const l of layerList) {
      if (!map.getLayer(l.id)) continue;

      if (l.paint && typeof map.setPaintProperty === 'function') {
        let prevPaint = lastPaintPropsRef.current.get(l.id);
        if (!prevPaint) {
          prevPaint = new Map();
          lastPaintPropsRef.current.set(l.id, prevPaint);
        }

        for (const [key, value] of Object.entries(l.paint)) {
          if (prevPaint.get(key) !== value) {
            map.setPaintProperty(l.id, key as Parameters<typeof map.setPaintProperty>[1], value);
            prevPaint.set(key, value);
          }
        }
      }

      if (l.layout && typeof map.setLayoutProperty === 'function') {
        let prevLayout = lastLayoutPropsRef.current.get(l.id);
        if (!prevLayout) {
          prevLayout = new Map();
          lastLayoutPropsRef.current.set(l.id, prevLayout);
        }

        for (const [key, value] of Object.entries(l.layout)) {
          if (prevLayout.get(key) !== value) {
            map.setLayoutProperty(l.id, key as Parameters<typeof map.setLayoutProperty>[1], value);
            prevLayout.set(key, value);
          }
        }
      }
    }
  }, [map, layers, layer]);

  // 3. Reactive data synchronization
  useEffect(() => {
    if (!map || data === undefined) return;

    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (!source || typeof source.setData !== 'function') return;

    source.setData(data ?? EMPTY_FEATURE_COLLECTION);
  }, [map, sourceId, data]);

  return { getSource, setData };
}
