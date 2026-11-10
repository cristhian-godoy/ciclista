import React, { useMemo, useState } from 'react';

import type { CrossingTurnOverride, CrossingTurnType } from '../core/config/types';
import { useCrossingEditorData } from '../hooks/useCrossingEditorData';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { Badge } from './common/Badge';
import { CloseButton } from './common/CloseButton';
import { EmptyState } from './common/EmptyState';
import { Ban, Check, ChevronRight, Clock, GitFork, Trash2 } from './common/Icon';
import { SegmentedControl } from './common/SegmentedControl';
import { type EditSubMode, MapContext } from './map/MapContext';

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
const HASH_PREFIX = '#';

interface CrossingOverrideItemProps {
  override: CrossingTurnOverride;
  subtext: string;
  onSelect: () => void;
  onDelete: () => void;
}

/**
 * Item row displaying a configured crossing turn penalty override.
 */
const CrossingOverrideItem: React.FC<CrossingOverrideItemProps> = ({
  override,
  subtext,
  onSelect,
  onDelete,
}) => (
  <div
    className="ciclista-crossing-override-item ciclista-crossing-override-item--interactive"
    onClick={onSelect}
  >
    <div>
      <div>
        #{override.fromNodeId} → #{override.toNodeId}
      </div>
      <div className="ciclista-crossing-override-subtext">{subtext}</div>
    </div>
    <div className="ciclista-crossing-override-actions">
      {override.banned ? (
        <Badge variant="banned">BANNED</Badge>
      ) : (
        <span>
          {override.timeDeltaSeconds > 0
            ? `+${override.timeDeltaSeconds}s`
            : `${override.timeDeltaSeconds}s`}
        </span>
      )}
      <CloseButton
        size="sm"
        variant="modal"
        label="Delete override"
        icon={<Trash2 size={14} />}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      />
    </div>
  </div>
);

interface TurnConfigFormProps {
  activeCrossingId: string;
  activeTurnSelection: {
    fromNodeId: string | null;
    toNodeId: string | null;
    waypointNodeIds: string[];
  };
  computedTurnPath: string[] | null;
  existingOverride: CrossingTurnOverride | null;
  onSaveTurn: (override: CrossingTurnOverride) => void;
  onDeleteTurn: (id: string) => void;
  onRemoveWaypoint: (nodeId: string) => void;
  onClearSelection: () => void;
}

/**
 * Form subcomponent managing interactive crossing turn penalty overrides and restrictions.
 */
const TurnConfigForm: React.FC<TurnConfigFormProps> = ({
  activeCrossingId,
  activeTurnSelection,
  computedTurnPath,
  existingOverride,
  onSaveTurn,
  onDeleteTurn,
  onRemoveWaypoint,
  onClearSelection,
}) => {
  const [timeDelta, setTimeDelta] = useState<number>(() => existingOverride?.timeDeltaSeconds ?? 0);
  const [isBanned, setIsBanned] = useState<boolean>(() => Boolean(existingOverride?.banned));
  const [turnType, setTurnType] = useState<CrossingTurnType>(
    () => existingOverride?.turnType ?? 'direct',
  );
  const [description, setDescription] = useState<string>(() => existingOverride?.description ?? '');

  const handleSave = () => {
    if (!activeCrossingId || !activeTurnSelection.fromNodeId || !activeTurnSelection.toNodeId) {
      return;
    }

    const id =
      existingOverride?.id ??
      `turn-${activeCrossingId}-${activeTurnSelection.fromNodeId}-${activeTurnSelection.toNodeId}`;

    const override: CrossingTurnOverride = {
      id,
      crossingId: activeCrossingId,
      fromNodeId: activeTurnSelection.fromNodeId,
      toNodeId: activeTurnSelection.toNodeId,
      pathNodeIds: computedTurnPath ?? existingOverride?.pathNodeIds ?? undefined,
      timeDeltaSeconds: Number(timeDelta),
      banned: isBanned,
      turnType,
      description: description.trim() || undefined,
    };

    onSaveTurn(override);
  };

  const isSelectionDirty = Boolean(
    activeTurnSelection.fromNodeId ||
    activeTurnSelection.toNodeId ||
    activeTurnSelection.waypointNodeIds.length > 0,
  );

  return (
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
        {isSelectionDirty && (
          <button
            type="button"
            className="ciclista-crossing-tag-btn"
            onClick={onClearSelection}
            title="Clear turn selection"
          >
            Clear Selection
          </button>
        )}
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
                onClick={() => onRemoveWaypoint(wpId)}
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
          <label htmlFor="crossing-time-delta-slider" className="ciclista-crossing-slider-label">
            <Clock size={14} /> Time Delta Penalty
          </label>
          <span>{timeDelta > 0 ? `+${timeDelta}` : timeDelta}s</span>
        </div>
        <div className="ciclista-crossing-slider-input-row">
          <input
            id="crossing-time-delta-slider"
            name="timeDeltaSlider"
            aria-label="Time Delta Penalty slider"
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
            id="crossing-time-delta-input"
            name="timeDeltaInput"
            aria-label="Time Delta Penalty seconds"
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
        <label htmlFor="crossing-hard-ban" className="ciclista-crossing-ban-label">
          <Ban size={16} /> Hard Ban Turn
        </label>
        <input
          id="crossing-hard-ban"
          name="hardBan"
          aria-label="Hard Ban Turn"
          type="checkbox"
          checked={isBanned}
          onChange={(e) => setIsBanned(e.target.checked)}
        />
      </div>

      {/* Description / Notes */}
      <div className="ciclista-crossing-slider-group">
        <div className="ciclista-crossing-slider-header">
          <label htmlFor="crossing-description-input" className="ciclista-crossing-slider-label">
            Description / Notes
          </label>
        </div>
        <input
          id="crossing-description-input"
          name="crossingDescription"
          aria-label="Description / Notes"
          type="text"
          className="ciclista-input"
          placeholder="e.g. Traffic light cycle or protected phase"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="ciclista-crossing-actions-row">
        <button
          type="button"
          className="ciclista-crossing-btn-save"
          disabled={
            !activeTurnSelection.fromNodeId || !activeTurnSelection.toNodeId || !computedTurnPath
          }
          onClick={handleSave}
        >
          <Check size={14} className="ciclista-crossing-btn-icon-prefix" />
          Save Turn Override
        </button>
        {existingOverride && (
          <button
            type="button"
            className="ciclista-crossing-btn-delete"
            title="Delete this override"
            onClick={() => {
              onDeleteTurn(existingOverride.id);
              onClearSelection();
            }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

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
  const setManagedClusterId = mapCtx?.setManagedClusterId;
  const setManagedNodeIds = mapCtx?.setManagedNodeIds;
  const customNodeDelays = mapCtx?.customNodeDelays;
  const showMinorControls = mapCtx?.showMinorControls ?? true;
  const editSubMode = mapCtx?.editSubMode ?? 'paths';
  const setEditSubMode = mapCtx?.setEditSubMode ?? (() => {});

  const { activeCluster, computedTurnPath } = useCrossingEditorData({
    graph,
    customNodeDelays,
    showMinorControls,
    activeCrossingId,
    activeTurnSelection,
  });

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

  const configuredSignals = useMemo(() => {
    if (!activeCluster || !customNodeDelays) return [];
    return activeCluster.nodeIds
      .filter((id) => customNodeDelays.has(id))
      .map((id) => ({ id, delay: customNodeDelays.get(id)! }));
  }, [activeCluster, customNodeDelays]);

  const handleSelectExistingOverride = (override: CrossingTurnOverride) => {
    setActiveTurnSelection({
      fromNodeId: override.fromNodeId,
      toNodeId: override.toNodeId,
      waypointNodeIds: override.pathNodeIds ? [...override.pathNodeIds] : [],
    });
  };

  const handleClearSelection = () => {
    setActiveTurnSelection({
      fromNodeId: null,
      toNodeId: null,
      waypointNodeIds: [],
    });
  };

  const handleRemoveWaypoint = (nodeId: string) => {
    setActiveTurnSelection((prev) => ({
      ...prev,
      waypointNodeIds: prev.waypointNodeIds.filter((id) => id !== nodeId),
    }));
  };

  const isTurnSelectionDirty = Boolean(
    activeTurnSelection.fromNodeId ||
    activeTurnSelection.toNodeId ||
    activeTurnSelection.waypointNodeIds.length > 0,
  );

  useEscapeKey(() => {
    if (isTurnSelectionDirty) {
      handleClearSelection();
    } else if (activeCrossingId) {
      setActiveCrossingId(null);
      setManagedClusterId?.(null);
      setManagedNodeIds?.([]);
      handleClearSelection();
    }
  });

  const turnConfigKey = `${activeCrossingId}-${activeTurnSelection.fromNodeId}-${activeTurnSelection.toNodeId}-${existingOverrideForCurrentSelection?.id ?? 'none'}-${existingOverrideForCurrentSelection?.timeDeltaSeconds ?? 0}-${existingOverrideForCurrentSelection?.banned ?? false}-${existingOverrideForCurrentSelection?.turnType ?? 'direct'}`;

  return (
    <div className="ciclista-crossing-edit-panel">
      {/* Sub-mode Segmented Toggle */}
      <div className="ciclista-crossing-submode-container">
        <SegmentedControl<EditSubMode>
          options={[
            { key: 'paths', label: 'Turn Paths' },
            { key: 'signals', label: 'Traffic Signals' },
          ]}
          value={editSubMode}
          onChange={setEditSubMode}
          showDescription={false}
          ariaLabel="Edit sub-mode"
        />
      </div>

      {editSubMode === 'paths' ? (
        <>
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
                  <CloseButton
                    variant="modal"
                    label="Deselect crossing"
                    onClick={() => {
                      setActiveCrossingId(null);
                      setManagedClusterId?.(null);
                      setManagedNodeIds?.([]);
                      handleClearSelection();
                    }}
                  />
                </div>
                <div className="ciclista-crossing-summary-details">
                  <span>{activeCluster.nodeIds.length} nodes</span>
                  <span>Radius: ~{Math.round(activeCluster.radiusMeters)}m</span>
                  <Badge variant="subtle">{activeCluster.controlType}</Badge>
                </div>
              </div>

              {/* Turn Configuration Form Keyed for Clean Sync */}
              <TurnConfigForm
                key={turnConfigKey}
                activeCrossingId={activeCrossingId ?? activeCluster.id}
                activeTurnSelection={activeTurnSelection}
                computedTurnPath={computedTurnPath}
                existingOverride={existingOverrideForCurrentSelection ?? null}
                onSaveTurn={onSaveCrossingTurn}
                onDeleteTurn={onDeleteCrossingTurn}
                onRemoveWaypoint={handleRemoveWaypoint}
                onClearSelection={handleClearSelection}
              />

              {/* Configured Overrides for this Crossing */}
              {clusterOverrides.length > 0 && (
                <div className="ciclista-crossing-slider-group">
                  <span className="ciclista-crossing-legend-title">
                    Saved Overrides ({clusterOverrides.length})
                  </span>
                  <div className="ciclista-crossing-overrides-list">
                    {clusterOverrides.map((override) => (
                      <CrossingOverrideItem
                        key={override.id}
                        override={override}
                        subtext={override.turnType ?? 'direct'}
                        onSelect={() => handleSelectExistingOverride(override)}
                        onDelete={() => onDeleteCrossingTurn(override.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty State: Prompt User to Select a Crossing */
            <div className="ciclista-crossing-empty-state-wrapper">
              <EmptyState
                className="ciclista-crossing-summary-card ciclista-crossing-empty-state-card"
                icon={<GitFork size={32} className="ciclista-crossing-empty-state-icon" />}
                title="Select a Crossing"
                description="Click an intersection or crossing cluster on the map to inspect internal edges and configure turn penalties."
              />

              {/* All Configured Crossing Overrides Across Graph */}
              {crossingTurns.length > 0 && (
                <div className="ciclista-crossing-slider-group">
                  <span className="ciclista-crossing-legend-title">
                    All Configured Overrides ({crossingTurns.length})
                  </span>
                  <div className="ciclista-crossing-overrides-list">
                    {crossingTurns.map((override) => (
                      <CrossingOverrideItem
                        key={override.id}
                        override={override}
                        subtext={`Crossing ${override.crossingId.replace(/^(crossing|cluster)-/, HASH_PREFIX)}`}
                        onSelect={() => {
                          setActiveCrossingId(override.crossingId);
                          handleSelectExistingOverride(override);
                        }}
                        onDelete={() => onDeleteCrossingTurn(override.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Signals sub-mode */
        <>
          {activeCluster ? (
            <>
              {/* Intersection Summary Card */}
              <div className="ciclista-crossing-summary-card">
                <div className="ciclista-crossing-summary-header">
                  <span className="ciclista-crossing-summary-title">
                    Intersection {activeCluster.id.replace(/^(crossing|cluster)-/, '#')}
                  </span>
                  <CloseButton
                    variant="modal"
                    label="Deselect intersection"
                    onClick={() => {
                      setActiveCrossingId(null);
                      setManagedClusterId?.(null);
                      setManagedNodeIds?.([]);
                      handleClearSelection();
                    }}
                  />
                </div>
                <div className="ciclista-crossing-summary-details">
                  <span>{activeCluster.nodeIds.length} signals</span>
                  <span>Radius: ~{Math.round(activeCluster.radiusMeters)}m</span>
                  <Badge variant="subtle">{activeCluster.controlType}</Badge>
                </div>
              </div>

              {/* Signal Configuration Overview and Delay Summary */}
              <div className="ciclista-crossing-slider-group">
                <span className="ciclista-crossing-legend-title">Signal Configuration</span>
                <div className="ciclista-crossing-signals-summary">
                  <p className="ciclista-crossing-signals-prompt">
                    Click an unclustered signal on the map to configure its delay and phase timing
                    in the signal popup.
                  </p>
                  <div className="ciclista-crossing-signals-stats">
                    <span>
                      Total Signals: <strong>{activeCluster.nodeIds.length}</strong>
                    </span>
                    <span>
                      Configured Overrides: <strong>{configuredSignals.length}</strong>
                    </span>
                  </div>
                  {configuredSignals.length > 0 && (
                    <div className="ciclista-crossing-overrides-list">
                      {configuredSignals.map((sig) => (
                        <div key={sig.id} className="ciclista-crossing-override-item">
                          <div>Signal #{sig.id}</div>
                          <div className="ciclista-crossing-override-actions">
                            <span>+{sig.delay}s</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="ciclista-crossing-empty-state-wrapper">
              <EmptyState
                className="ciclista-crossing-summary-card ciclista-crossing-empty-state-card"
                icon={<GitFork size={32} className="ciclista-crossing-empty-state-icon" />}
                title="Select an Intersection"
                description="Click a traffic signal cluster on the map to uncluster its signals and configure wait penalties."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
