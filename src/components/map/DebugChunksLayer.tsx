import React, { useMemo } from 'react';

import { OSMNetworkQueue } from '../../core/api/OSMNetworkQueue';
import { coordToChunkId, getChunkBBox } from '../../core/common/geo';
import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
import { getInMemoryChunkGraph, getInMemoryChunkIds } from '../../core/storage/chunkCache';
import { type GeoJsonLayerSpec, useGeoJsonLayer } from '../../hooks/useGeoJsonLayer';
import { useMapContext } from './MapContext';

const SOURCE_ID = 'debug-chunks';

/**
 * Map overlay layer that visualizes cached and loaded spatial chunks,
 * per-chunk bounding boxes, and node counters during debug mode.
 *
 * @returns Null as this component imperatively manages MapLibre layers.
 */
export const DebugChunksLayer: React.FC = () => {
  const {
    map,
    graph,
    loadedChunkIds = [],
    theme,
    appMode,
    debugSubMode = 'chunks',
    selectedDebugChunkId = null,
  } = useMapContext();

  const isChunksActive = appMode === 'debug' && (debugSubMode ?? 'chunks') === 'chunks';

  const geojson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon>>(() => {
    if (!isChunksActive) {
      return {
        type: 'FeatureCollection',
        features: [],
      };
    }

    const chunkIdSet = new Set<string>();
    if (loadedChunkIds) {
      for (const id of loadedChunkIds) {
        if (id) chunkIdSet.add(id);
      }
    }
    for (const id of getInMemoryChunkIds()) {
      if (id) chunkIdSet.add(id);
    }
    for (const id of OSMNetworkQueue.getPendingChunkIds()) {
      if (id) chunkIdSet.add(id);
    }

    const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

    for (const chunkId of chunkIdSet) {
      const [minLat, minLng, maxLat, maxLng] = getChunkBBox(chunkId);
      const inMem = getInMemoryChunkGraph(chunkId);
      let nodeCount = inMem?.nodes.size;
      if (nodeCount === undefined && graph) {
        let count = 0;
        for (const entry of graph.nodes.values()) {
          if (coordToChunkId(entry.node.lat, entry.node.lng) === chunkId) {
            count++;
          }
        }
        nodeCount = count;
      }
      nodeCount = nodeCount ?? 0;

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ],
          ],
        },
        properties: {
          chunkId,
          nodeCount,
          selected: chunkId === selectedDebugChunkId,
          label: `${chunkId}\n${nodeCount} nodes`,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [isChunksActive, loadedChunkIds, graph, selectedDebugChunkId]);

  const layers = useMemo<GeoJsonLayerSpec[]>(() => {
    const lineColor =
      theme === 'dark' ? MAP_THEME_TOKENS.brand.sky : MAP_THEME_TOKENS.brand.skyGlow;

    return [
      {
        id: 'debug-chunks-fill-layer',
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'selected'], true],
            MAP_THEME_TOKENS.brand.amber,
            lineColor,
          ],
          'fill-opacity': ['case', ['==', ['get', 'selected'], true], 0.18, 0.05],
        },
      },
      {
        id: 'debug-chunks-line-layer',
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'selected'], true],
            MAP_THEME_TOKENS.brand.amber,
            lineColor,
          ],
          'line-width': ['case', ['==', ['get', 'selected'], true], 2.5, 1.5],
          'line-dasharray': [2, 2],
          'line-opacity': 0.85,
        },
      },
      {
        id: 'debug-chunks-label-layer',
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-anchor': 'center',
        },
        paint: {
          'text-color':
            theme === 'dark' ? MAP_THEME_TOKENS.overlay.white : MAP_THEME_TOKENS.overlay.darkNavy,
          'text-halo-color':
            theme === 'dark' ? MAP_THEME_TOKENS.overlay.darkNavy : MAP_THEME_TOKENS.overlay.white,
          'text-halo-width': 1.5,
        },
      },
    ];
  }, [theme]);

  useGeoJsonLayer({
    map,
    sourceId: SOURCE_ID,
    layers,
    data: geojson,
  });

  return null;
};
