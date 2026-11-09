import React, { useContext, useMemo, useState } from 'react';

import { OSMNetworkQueue } from '../core/api/OSMNetworkQueue';
import { coordToChunkId, getChunkBBox } from '../core/common/geo';
import type { RouteResult } from '../core/router/types';
import { getInMemoryChunkGraph, getInMemoryChunkIds } from '../core/storage/chunkCache';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { Badge, type BadgeVariant } from './common/Badge';
import { EmptyState } from './common/EmptyState';
import { Bug, Check, Copy, RefreshCw } from './common/Icon';
import { SegmentedControl } from './common/SegmentedControl';
import {
  type DebugSubMode,
  MapContext,
  MapInstanceContext,
  RoutingStateContext,
} from './map/MapContext';

/**
 * Maps chunk cache status to badge visual variant.
 *
 * @param status - State of network chunk in memory or queue.
 * @returns Compatible Badge component variant.
 */
function getStatusBadgeVariant(status: 'Loaded' | 'Cached' | 'Pending'): BadgeVariant {
  switch (status) {
    case 'Loaded':
      return 'pass';
    case 'Cached':
      return 'subtle';
    case 'Pending':
      return 'idle';
  }
}

/**
 * Properties for the DebugPanel component.
 */
export interface DebugPanelProps {
  /**
   * Optional active route result containing calculated edges and timing metrics.
   */
  routeResult?: RouteResult | null;
}

/**
 * Sidebar panel displaying street network chunk cache states, node counts,
 * and routing path edge diagnostics when in debug mode.
 */
export const DebugPanel: React.FC<DebugPanelProps> = ({ routeResult }) => {
  const mapCtx = useContext(MapContext);
  const mapInstanceCtx = useContext(MapInstanceContext);
  const routingCtx = useContext(RoutingStateContext);

  const graph = mapCtx?.graph ?? routingCtx?.graph ?? null;
  const loadedChunkIds = mapCtx?.loadedChunkIds ?? routingCtx?.loadedChunkIds ?? [];
  const onRefreshChunk = mapCtx?.onRefreshChunk ?? routingCtx?.onRefreshChunk;
  const debugSubModeFromCtx = mapCtx?.debugSubMode ?? routingCtx?.debugSubMode;
  const setDebugSubMode = mapCtx?.setDebugSubMode ?? routingCtx?.setDebugSubMode;
  const selectedDebugChunkIdFromCtx =
    mapCtx?.selectedDebugChunkId !== undefined
      ? mapCtx.selectedDebugChunkId
      : routingCtx?.selectedDebugChunkId;
  const setSelectedDebugChunkId =
    mapCtx?.setSelectedDebugChunkId ?? routingCtx?.setSelectedDebugChunkId;
  const routeVariants = mapCtx?.routeVariants ?? routingCtx?.routeVariants ?? [];
  const activeAlternativeLabel =
    mapCtx?.activeAlternativeLabel ?? routingCtx?.activeAlternativeLabel ?? 'standard';
  const map = mapCtx?.map ?? mapInstanceCtx?.map;

  const [localSubMode, setLocalSubMode] = useState<DebugSubMode>('chunks');
  const activeSubMode = debugSubModeFromCtx ?? localSubMode;

  const handleSubModeChange = (mode: DebugSubMode) => {
    if (setDebugSubMode) {
      setDebugSubMode(mode);
    } else {
      setLocalSubMode(mode);
    }
  };

  const [localSelectedChunkId, setLocalSelectedChunkId] = useState<string | null>(null);
  const activeSelectedChunkId =
    selectedDebugChunkIdFromCtx !== undefined
      ? selectedDebugChunkIdFromCtx
      : localSelectedChunkId;

  useEscapeKey(() => {
    if (activeSelectedChunkId) {
      setSelectedDebugChunkId?.(null);
      setLocalSelectedChunkId(null);
    }
  }, Boolean(activeSelectedChunkId));

  const handleSelectChunk = (chunkId: string) => {
    const nextSelected = activeSelectedChunkId === chunkId ? null : chunkId;
    if (setSelectedDebugChunkId) {
      setSelectedDebugChunkId(nextSelected);
    } else {
      setLocalSelectedChunkId(nextSelected);
    }

    if (map?.easeTo) {
      const [minLat, minLng, maxLat, maxLng] = getChunkBBox(chunkId);
      map.easeTo({
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        duration: 300,
      });
    }
  };

  const [copied, setCopied] = useState(false);

  const effectiveRouteResult: RouteResult | null = useMemo(() => {
    if (routeResult) {
      return routeResult;
    }
    const matching = routeVariants.find((v) => v.label === activeAlternativeLabel);
    return matching?.result ?? routeVariants[0]?.result ?? null;
  }, [routeResult, routeVariants, activeAlternativeLabel]);

  const handleCopyDebug = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!effectiveRouteResult || !effectiveRouteResult.edges) return;

    const debugText = JSON.stringify(
      {
        totalDurationSeconds: effectiveRouteResult.totalDurationSeconds,
        totalDistanceMeters: effectiveRouteResult.totalDistanceMeters,
        trafficSignalsCount: effectiveRouteResult.trafficSignalsCount,
        edges: effectiveRouteResult.edges.map((edge) => ({
          name: edge.name,
          highway: edge.highway,
          distance: edge.distance,
          cost: edge.cost,
          tags: edge.tags,
        })),
      },
      null,
      2,
    );

    void navigator.clipboard.writeText(debugText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const chunkItems = useMemo(() => {
    const pendingSet = new Set(OSMNetworkQueue.getPendingChunkIds());
    const loadedSet = new Set(loadedChunkIds);
    const inMemoryIds = getInMemoryChunkIds();

    const allChunkIds = Array.from(
      new Set([...loadedChunkIds, ...inMemoryIds, ...OSMNetworkQueue.getPendingChunkIds()]),
    ).sort();

    return allChunkIds.map((chunkId) => {
      let nodeCount = 0;
      let edgeCount = 0;

      const inMemoryGraph = getInMemoryChunkGraph(chunkId);
      if (inMemoryGraph) {
        nodeCount = inMemoryGraph.nodes.size;
        for (const entry of inMemoryGraph.nodes.values()) {
          edgeCount += entry.edges.length;
        }
      } else if (graph) {
        for (const entry of graph.nodes.values()) {
          if (coordToChunkId(entry.node.lat, entry.node.lng) === chunkId) {
            nodeCount++;
            edgeCount += entry.edges.length;
          }
        }
      }

      let status: 'Pending' | 'Loaded' | 'Cached';
      if (pendingSet.has(chunkId)) {
        status = 'Pending';
      } else if (loadedSet.has(chunkId)) {
        status = 'Loaded';
      } else {
        status = 'Cached';
      }

      return {
        chunkId,
        nodeCount,
        edgeCount,
        status,
      };
    });
  }, [loadedChunkIds, graph]);

  return (
    <div className="ciclista-debug-panel">
      {/* Sub-mode Segmented Toggle */}
      <div className="ciclista-crossing-submode-container">
        <SegmentedControl<DebugSubMode>
          options={[
            { key: 'chunks', label: 'Cached Chunks' },
            { key: 'route', label: 'Route Edges' },
          ]}
          value={activeSubMode}
          onChange={handleSubModeChange}
          showDescription={false}
          ariaLabel="Debug sub-mode"
        />
      </div>

      {/* Cached Chunks sub-mode */}
      {activeSubMode === 'chunks' && (
        <>
          <div className="ciclista-card ciclista-crossing-summary-card">
            <div className="ciclista-crossing-summary-header">
              <span className="ciclista-crossing-summary-title">Network Chunks</span>
            </div>
            <div className="ciclista-crossing-summary-details">
              <span>
                {chunkItems.length} {chunkItems.length === 1 ? 'chunk' : 'chunks'}
              </span>
              <span>{graph ? graph.nodes.size : 0} nodes</span>
            </div>
          </div>

          {chunkItems.length === 0 ? (
            <EmptyState
              title="No Cached Chunks"
              description="Pan or zoom the map to load street network chunks."
            />
          ) : (
            <div className="ciclista-crossing-overrides-list">
              {chunkItems.map((chunk) => {
                const isSelected = activeSelectedChunkId === chunk.chunkId;
                return (
                  <div
                    key={chunk.chunkId}
                    className={`ciclista-crossing-override-item ciclista-crossing-override-item--interactive ${
                      isSelected ? 'active' : ''
                    }`}
                    onClick={() => handleSelectChunk(chunk.chunkId)}
                  >
                    <div>
                      <div>Chunk {chunk.chunkId}</div>
                      <div className="ciclista-crossing-override-subtext">
                        {chunk.nodeCount} nodes · {chunk.edgeCount} edges
                      </div>
                    </div>
                    <div className="ciclista-crossing-override-actions">
                      <Badge size="sm" variant={getStatusBadgeVariant(chunk.status)}>
                        {chunk.status}
                      </Badge>
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary ciclista-waypoint-action-btn"
                        aria-label={`Refresh chunk ${chunk.chunkId}`}
                        title={`Refresh chunk ${chunk.chunkId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onRefreshChunk?.(chunk.chunkId);
                        }}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Route Edges sub-mode */}
      {activeSubMode === 'route' && (
        <>
          {!effectiveRouteResult ||
          !effectiveRouteResult.edges ||
          effectiveRouteResult.edges.length === 0 ? (
            <EmptyState
              title="No Active Route"
              description="Place start and destination pins on the map to inspect route edges."
            />
          ) : (
            <section className="ciclista-card">
              <div className="stats-debug-header">
                <div className="stats-debug-title">
                  <Bug size={16} className="stats-debug-icon" />
                  <span>Route Edges ({effectiveRouteResult.edges.length})</span>
                </div>
                <div className="stats-debug-actions">
                  <button
                    type="button"
                    onClick={handleCopyDebug}
                    title="Copy path debug info to clipboard"
                    className="stats-copy-btn"
                  >
                    {copied ? (
                      <>
                        <Check size={10} className="badge-bike" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={10} />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="stats-debug-container">
                {effectiveRouteResult.edges.map((edge, index) => (
                  <div key={index} className="stats-edge-item">
                    <div className="stats-edge-title">
                      <span>
                        {index + 1}. {edge.name}
                      </span>
                      {edge.matchedSign && (
                        <Badge variant="tag" className="stats-tag-badge">
                          {edge.matchedSign}
                        </Badge>
                      )}
                      {!edge.matchedSign && edge.matchedRoad && (
                        <Badge variant="road" className="stats-tag-badge stats-tag-badge--road">
                          {edge.matchedRoad}
                        </Badge>
                      )}
                    </div>
                    <div className="stats-edge-row">
                      <span>
                        Type:{' '}
                        <Badge variant="bike" className="badge-bike">
                          {edge.highway}
                        </Badge>
                      </span>
                      <span>{Math.round(edge.distance)}m</span>
                      <span>Cost: {Math.round(edge.cost)}s</span>
                    </div>
                    {edge.tags && Object.entries(edge.tags).length > 0 && (
                      <div className="stats-tags-box">
                        {Object.entries(edge.tags).map(([key, val]) => (
                          <div key={key} className="stats-tag-kv">
                            <strong className="text-secondary">{key}:</strong> {String(val)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
