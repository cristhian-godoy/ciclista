import { Ban, Check, ChevronRight, Clock, GitFork, Trash2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { CrossingTurnOverride, CrossingTurnType } from '../core/config/types';
import {
  buildCrossingSubgraph,
  extractCrossingClusters,
  findCrossingTurnPath,
} from '../core/graph/crossing';
import { MapContext } from './map/MapContext';

const TURN_TYPE_OPTIONS: Array<{ type: CrossingTurnType; label: string }> = [
  { type: 'direct', label: 'Direct' },
  { type: 'copenhagen_two_stage', label: 'Copenhagen Two-Stage' },
  { type: 'green_arrow', label: 'Green Arrow' },
  { type: 'custom', label: 'Custom' },
];

const DEFAULT_TURN_SELECTION: {
  fromNodeId: string | null;
  toNodeId: string | null;
  waypointNodeIds: string[];
} = {
  fromNodeId: null,
  toNodeId: null,
  waypointNodeIds: [],
};

const DEFAULT_CROSSING_TURNS: CrossingTurnOverride[] = [];

/**
 * Sidebar panel for TM:PE-style crossing turn penalty configuration and edge inspection.
 */
export const CrossingEditPanel: React.FC = () => {
  const mapCtx = React.useContext(MapContext);
  const graph = mapCtx?.graph ?? null;
  const activeCrossingId = mapCtx?.activeCrossingId ?? null;
  const setActiveCrossingId = mapCtx?.setActiveCrossingId ?? (() => {});
  const activeTurnSelection = mapCtx?.activeTurnSelection ?? DEFAULT_TURN_SELECTION;
  const setActiveTurnSelection = mapCtx?.setActiveTurnSelection ?? (() => {});
  const crossingTurns = mapCtx?.crossingTurns ?? DEFAULT_CROSSING_TURNS;
  const onSaveCrossingTurn = mapCtx?.onSaveCrossingTurn ?? (() => {});
  const onDeleteCrossingTurn = mapCtx?.onDeleteCrossingTurn ?? (() => {});
  const customNodeDelays = mapCtx?.customNodeDelays;
  const showMinorControls = mapCtx?.showMinorControls ?? true;

  const [timeDelta, setTimeDelta] = useState<number>(0);
  const [isBanned, setIsBanned] = useState<boolean>(false);
  const [turnType, setTurnType] = useState<CrossingTurnType>('direct');
  const [description, setDescription] = useState<string>('');

  // Extract all crossing clusters from the active street graph
  const clusters = useMemo(() => {
    if (!graph) return [];
    return extractCrossingClusters(graph, customNodeDelays, showMinorControls);
  }, [graph, customNodeDelays, showMinorControls]);

  const activeCluster = useMemo(() => {
    if (!activeCrossingId) return null;
    return clusters.find((c) => c.id === activeCrossingId) ?? null;
  }, [clusters, activeCrossingId]);

  // Subgraph for the active crossing cluster
  const crossingSubgraph = useMemo(() => {
    if (!graph || !activeCluster) return null;
    return buildCrossingSubgraph(graph, activeCluster);
  }, [graph, activeCluster]);

  // Compute turn path using Mini A* on the crossing subgraph
  const computedTurnPath = useMemo(() => {
    if (!crossingSubgraph || !activeTurnSelection.fromNodeId || !activeTurnSelection.toNodeId) {
      return null;
    }
    return findCrossingTurnPath(
      crossingSubgraph,
      activeTurnSelection.fromNodeId,
      activeTurnSelection.toNodeId,
      activeTurnSelection.waypointNodeIds,
    );
  }, [crossingSubgraph, activeTurnSelection]);

  // Existing override matching the current from -> to selection
  const existingOverrideForCurrentSelection = useMemo(() => {
    if (!activeCrossingId || !activeTurnSelection.fromNodeId || !activeTurnSelection.toNodeId) {
      return null;
    }
    return crossingTurns.find(
      (t) =>
        t.crossingId === activeCrossingId &&
        t.fromNodeId === activeTurnSelection.fromNodeId &&
        t.toNodeId === activeTurnSelection.toNodeId,
    );
  }, [crossingTurns, activeCrossingId, activeTurnSelection]);

  // Overrides belonging to the current crossing
  const clusterOverrides = useMemo(() => {
    if (!activeCrossingId) return [];
    return crossingTurns.filter((t) => t.crossingId === activeCrossingId);
  }, [crossingTurns, activeCrossingId]);

  const handleSelectExistingOverride = (override: CrossingTurnOverride) => {
    setActiveTurnSelection({
      fromNodeId: override.fromNodeId,
      toNodeId: override.toNodeId,
      waypointNodeIds: [],
    });
    setTimeDelta(override.timeDeltaSeconds);
    setIsBanned(Boolean(override.banned));
    setTurnType(override.turnType ?? 'direct');
    setDescription(override.description ?? '');
  };

  const handleSaveTurn = () => {
    if (!activeCrossingId || !activeTurnSelection.fromNodeId || !activeTurnSelection.toNodeId) {
      return;
    }

    const id =
      existingOverrideForCurrentSelection?.id ??
      `turn-${activeCrossingId}-${activeTurnSelection.fromNodeId}-${activeTurnSelection.toNodeId}`;

    const override: CrossingTurnOverride = {
      id,
      crossingId: activeCrossingId,
      fromNodeId: activeTurnSelection.fromNodeId,
      toNodeId: activeTurnSelection.toNodeId,
      pathNodeIds: computedTurnPath ?? undefined,
      timeDeltaSeconds: Number(timeDelta),
      banned: isBanned,
      turnType,
      description: description.trim() || undefined,
    };

    onSaveCrossingTurn(override);
  };

  const handleClearSelection = () => {
    setActiveTurnSelection({
      fromNodeId: null,
      toNodeId: null,
      waypointNodeIds: [],
    });
    setTimeDelta(0);
    setIsBanned(false);
    setTurnType('direct');
    setDescription('');
  };

  const handleRemoveWaypoint = (nodeId: string) => {
    setActiveTurnSelection((prev) => ({
      ...prev,
      waypointNodeIds: prev.waypointNodeIds.filter((id) => id !== nodeId),
    }));
  };

  return (
    <div className="ciclista-crossing-edit-panel">
      {/* Edge Color Classification Legend */}
      <div className="ciclista-crossing-legend-container">
        <span className="ciclista-crossing-legend-title">Crossing Edge Classification</span>
        <div className="ciclista-crossing-legend-items">
          <div className="ciclista-crossing-legend-item">
            <span className="ciclista-crossing-legend-swatch ciclista-crossing-legend-swatch--cycleway" />
            <span>Cycleway</span>
          </div>
          <div className="ciclista-crossing-legend-item">
            <span className="ciclista-crossing-legend-swatch ciclista-crossing-legend-swatch--residential" />
            <span>Residential</span>
          </div>
          <div className="ciclista-crossing-legend-item">
            <span className="ciclista-crossing-legend-swatch ciclista-crossing-legend-swatch--pedestrian" />
            <span>Pedestrian</span>
          </div>
          <div className="ciclista-crossing-legend-item">
            <span className="ciclista-crossing-legend-swatch ciclista-crossing-legend-swatch--arterial" />
            <span>Arterial</span>
          </div>
          <div className="ciclista-crossing-legend-item">
            <span className="ciclista-crossing-legend-swatch ciclista-crossing-legend-swatch--other" />
            <span>Other Road</span>
          </div>
          <div className="ciclista-crossing-legend-item">
            <span className="ciclista-crossing-legend-swatch ciclista-crossing-legend-swatch--active-turn" />
            <span>Turn Path</span>
          </div>
        </div>
      </div>

      {activeCluster ? (
        <>
          {/* Active Crossing Summary Card */}
          <div className="ciclista-crossing-summary-card">
            <div className="ciclista-crossing-summary-header">
              <span className="ciclista-crossing-summary-title">
                Crossing {activeCluster.id.replace(/^(crossing|cluster)-/, '#')}
              </span>
              <button
                type="button"
                className="ciclista-toast-close-btn"
                title="Deselect crossing"
                onClick={() => {
                  setActiveCrossingId(null);
                  handleClearSelection();
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="ciclista-crossing-summary-details">
              <span>{activeCluster.nodeIds.length} nodes</span>
              <span>Radius: ~{Math.round(activeCluster.radiusMeters)}m</span>
              <span className="ciclista-crossing-summary-badge">{activeCluster.controlType}</span>
            </div>
          </div>

          {/* Turn Configuration Form */}
          <div className="ciclista-crossing-turn-config">
            <div className="ciclista-crossing-turn-nodes-row">
              <div>
                <strong>From:</strong>{' '}
                <span>
                  {activeTurnSelection.fromNodeId
                    ? `Node #${activeTurnSelection.fromNodeId}`
                    : 'Click entry node'}
                </span>
              </div>
              <ChevronRight size={16} />
              <div>
                <strong>To:</strong>{' '}
                <span>
                  {activeTurnSelection.toNodeId
                    ? `Node #${activeTurnSelection.toNodeId}`
                    : 'Click exit node'}
                </span>
              </div>
            </div>

            {/* Pinned Waypoints */}
            {activeTurnSelection.waypointNodeIds.length > 0 && (
              <div className="ciclista-crossing-slider-header">
                <span>Waypoints:</span>
                <div className="ciclista-crossing-waypoints-list">
                  {activeTurnSelection.waypointNodeIds.map((wpId) => (
                    <button
                      key={wpId}
                      type="button"
                      className="ciclista-crossing-tag-btn"
                      onClick={() => handleRemoveWaypoint(wpId)}
                      title="Click to remove waypoint"
                    >
                      #{wpId} ×
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Computed Mini A* Route Status */}
            {activeTurnSelection.fromNodeId && activeTurnSelection.toNodeId && (
              <div
                className={`ciclista-crossing-turn-path-status ${
                  computedTurnPath
                    ? 'ciclista-crossing-turn-path-status--success'
                    : 'ciclista-crossing-turn-path-status--error'
                }`}
              >
                {computedTurnPath
                  ? `Computed Path: ${computedTurnPath.length} nodes`
                  : 'No valid path found between selected nodes'}
              </div>
            )}

            {/* Semantic Turn Type Tags */}
            <div className="ciclista-crossing-slider-group">
              <span className="ciclista-crossing-legend-title">Turn Type</span>
              <div className="ciclista-crossing-turn-type-tags">
                {TURN_TYPE_OPTIONS.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    className={`ciclista-crossing-tag-btn ${turnType === type ? 'active' : ''}`}
                    onClick={() => setTurnType(type)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Delta Penalty Slider */}
            <div className="ciclista-crossing-slider-group">
              <div className="ciclista-crossing-slider-header">
                <span className="ciclista-crossing-slider-label">
                  <Clock size={14} /> Time Delta Penalty
                </span>
                <span>{timeDelta > 0 ? `+${timeDelta}` : timeDelta}s</span>
              </div>
              <div className="ciclista-crossing-slider-input-row">
                <input
                  type="range"
                  className="ciclista-crossing-slider"
                  min={-30}
                  max={60}
                  step={1}
                  value={timeDelta}
                  disabled={isBanned}
                  onChange={(e) => setTimeDelta(Number(e.target.value))}
                />
                <input
                  type="number"
                  className="ciclista-crossing-number-input"
                  min={-30}
                  max={60}
                  value={timeDelta}
                  disabled={isBanned}
                  onChange={(e) => setTimeDelta(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Hard Ban Toggle */}
            <div className="ciclista-crossing-ban-toggle-row">
              <span className="ciclista-crossing-ban-label">
                <Ban size={16} /> Hard Ban Turn
              </span>
              <input
                type="checkbox"
                checked={isBanned}
                onChange={(e) => setIsBanned(e.target.checked)}
              />
            </div>

            {/* Actions */}
            <div className="ciclista-crossing-actions-row">
              <button
                type="button"
                className="ciclista-crossing-btn-save"
                disabled={
                  !activeTurnSelection.fromNodeId ||
                  !activeTurnSelection.toNodeId ||
                  !computedTurnPath
                }
                onClick={handleSaveTurn}
              >
                <Check size={14} className="ciclista-crossing-btn-icon-prefix" />
                Save Turn Override
              </button>
              {existingOverrideForCurrentSelection && (
                <button
                  type="button"
                  className="ciclista-crossing-btn-delete"
                  title="Delete this override"
                  onClick={() => {
                    onDeleteCrossingTurn(existingOverrideForCurrentSelection.id);
                    handleClearSelection();
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Configured Overrides for this Crossing */}
          {clusterOverrides.length > 0 && (
            <div className="ciclista-crossing-slider-group">
              <span className="ciclista-crossing-legend-title">
                Saved Overrides ({clusterOverrides.length})
              </span>
              <div className="ciclista-crossing-overrides-list">
                {clusterOverrides.map((override) => (
                  <div
                    key={override.id}
                    className="ciclista-crossing-override-item ciclista-crossing-override-item--interactive"
                    onClick={() => handleSelectExistingOverride(override)}
                  >
                    <div>
                      <div>
                        #{override.fromNodeId} → #{override.toNodeId}
                      </div>
                      <div className="ciclista-crossing-override-subtext">
                        {override.turnType ?? 'direct'}
                      </div>
                    </div>
                    <div className="ciclista-crossing-override-actions">
                      {override.banned ? (
                        <span className="ciclista-crossing-summary-badge ciclista-crossing-badge--banned">
                          BANNED
                        </span>
                      ) : (
                        <span>
                          {override.timeDeltaSeconds > 0
                            ? `+${override.timeDeltaSeconds}s`
                            : `${override.timeDeltaSeconds}s`}
                        </span>
                      )}
                      <button
                        type="button"
                        className="ciclista-toast-close-btn"
                        title="Delete override"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCrossingTurn(override.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Empty State: Prompt User to Select a Crossing */
        <div className="ciclista-crossing-empty-state-wrapper">
          <div className="ciclista-crossing-summary-card ciclista-crossing-empty-state-card">
            <GitFork size={32} className="ciclista-crossing-empty-state-icon" />
            <div className="ciclista-crossing-summary-title">Select a Crossing</div>
            <p className="ciclista-crossing-empty-state-desc">
              Click an intersection or crossing cluster on the map to inspect internal edges and
              configure turn penalties.
            </p>
          </div>

          {/* All Configured Crossing Overrides Across Graph */}
          {crossingTurns.length > 0 && (
            <div className="ciclista-crossing-slider-group">
              <span className="ciclista-crossing-legend-title">
                All Configured Overrides ({crossingTurns.length})
              </span>
              <div className="ciclista-crossing-overrides-list">
                {crossingTurns.map((override) => (
                  <div
                    key={override.id}
                    className="ciclista-crossing-override-item ciclista-crossing-override-item--interactive"
                    onClick={() => {
                      setActiveCrossingId(override.crossingId);
                      handleSelectExistingOverride(override);
                    }}
                  >
                    <div>
                      <div>
                        #{override.fromNodeId} → #{override.toNodeId}
                      </div>
                      <div className="ciclista-crossing-override-subtext">
                        Crossing {override.crossingId.replace(/^(crossing|cluster)-/, '#')}
                      </div>
                    </div>
                    <div className="ciclista-crossing-override-actions">
                      {override.banned ? (
                        <span className="ciclista-crossing-summary-badge ciclista-crossing-badge--banned">
                          BANNED
                        </span>
                      ) : (
                        <span>
                          {override.timeDeltaSeconds > 0
                            ? `+${override.timeDeltaSeconds}s`
                            : `${override.timeDeltaSeconds}s`}
                        </span>
                      )}
                      <button
                        type="button"
                        className="ciclista-toast-close-btn"
                        title="Delete override"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCrossingTurn(override.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
