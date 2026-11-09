import type * as maplibregl from 'maplibre-gl';
import React, { useMemo, useSyncExternalStore } from 'react';

import { OSMNetworkQueue } from '../../core/api/OSMNetworkQueue';
import { coordToChunkId, getChunkBBox } from '../../core/common/geo';
import { MAP_THEME_TOKENS } from '../../core/rendering/theme';
import { getInMemoryChunkGraph, getInMemoryChunkIds } from '../../core/storage/chunkCache';
import { type ChunkLifecycleState, chunkRegistry } from '../../core/storage/chunkRegistry';
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

  const registryChunks = useSyncExternalStore(
    (cb) => chunkRegistry.subscribe(cb),
    () => chunkRegistry.getSnapshot(),
  );

  const isChunksActive = appMode === 'debug' && (debugSubMode ?? 'chunks') === 'chunks';

  const geojson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon>>(() => {
    if (!isChunksActive) {
      return {
        type: 'FeatureCollection',
        features: [],
      };
    }

    const chunkMap = new Map<string, { state: ChunkLifecycleState; nodeCount?: number }>();

    for (const record of registryChunks) {
      chunkMap.set(record.chunkId, {
        state: record.state,
        nodeCount: record.nodeCount,
      });
    }

    for (const id of getInMemoryChunkIds()) {
      if (!id) continue;
      const existing = chunkMap.get(id);
      if (!existing) {
        chunkMap.set(id, { state: 'cached' });
      } else if (existing.state === 'uncached') {
        existing.state = 'cached';
      }
    }

    for (const id of OSMNetworkQueue.getPendingChunkIds()) {
      if (!id) continue;
      const existing = chunkMap.get(id);
      if (!existing) {
        chunkMap.set(id, { state: 'pending' });
      } else if (existing.state === 'uncached' || existing.state === 'cached') {
        existing.state = 'pending';
      }
    }

    for (const id of OSMNetworkQueue.getFetchingChunkIds()) {
      if (!id) continue;
      const existing = chunkMap.get(id);
      if (!existing) {
        chunkMap.set(id, { state: 'fetching' });
      } else if (existing.state !== 'loaded') {
        existing.state = 'fetching';
      }
    }

    if (loadedChunkIds) {
      for (const id of loadedChunkIds) {
        if (!id) continue;
        const existing = chunkMap.get(id);
        if (!existing) {
          chunkMap.set(id, { state: 'loaded' });
        } else {
          existing.state = 'loaded';
        }
      }
    }

    const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

    for (const [chunkId, info] of chunkMap.entries()) {
      const [minLat, minLng, maxLat, maxLng] = getChunkBBox(chunkId);
      const inMem = getInMemoryChunkGraph(chunkId);

      let nodeCount: number;
      if (inMem) {
        let count = 0;
        for (const entry of inMem.nodes.values()) {
          if (coordToChunkId(entry.node.lat, entry.node.lng) === chunkId) {
            count++;
          }
        }
        nodeCount = count;
      } else if (info.nodeCount && info.nodeCount > 0) {
        nodeCount = info.nodeCount;
      } else if (graph) {
        let count = 0;
        for (const entry of graph.nodes.values()) {
          if (coordToChunkId(entry.node.lat, entry.node.lng) === chunkId) {
            count++;
          }
        }
        nodeCount = count > 0 ? count : (info.nodeCount ?? 0);
      } else {
        nodeCount = info.nodeCount ?? 0;
      }

      const stateLabel = info.state.toUpperCase();

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
          state: info.state,
          selected: chunkId === selectedDebugChunkId,
          label: `${chunkId}\n${stateLabel} · ${nodeCount} nodes`,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [isChunksActive, registryChunks, loadedChunkIds, graph, selectedDebugChunkId]);

  const layers = useMemo<GeoJsonLayerSpec[]>(() => {
    const lineColor =
      theme === 'dark' ? MAP_THEME_TOKENS.brand.sky : MAP_THEME_TOKENS.brand.skyGlow;

    const chunkColorExpression = [
      'case',
      ['==', ['get', 'selected'], true],
      MAP_THEME_TOKENS.brand.amber,
      [
        'match',
        ['get', 'state'],
        'fetching',
        MAP_THEME_TOKENS.brand.orange,
        'pending',
        MAP_THEME_TOKENS.brand.purple,
        'cached',
        MAP_THEME_TOKENS.brand.indigo,
        'uncached',
        MAP_THEME_TOKENS.status.neutral,
        'error',
        MAP_THEME_TOKENS.status.danger,
        lineColor,
      ],
    ];

    return [
      {
        id: 'debug-chunks-fill-layer',
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': chunkColorExpression as unknown as maplibregl.ExpressionSpecification,
          'fill-opacity': [
            'case',
            ['==', ['get', 'selected'], true],
            0.22,
            ['==', ['get', 'state'], 'fetching'],
            0.16,
            ['==', ['get', 'state'], 'pending'],
            0.12,
            0.05,
          ],
        },
      },
      {
        id: 'debug-chunks-line-layer',
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': chunkColorExpression as unknown as maplibregl.ExpressionSpecification,
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
