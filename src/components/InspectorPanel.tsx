import React from 'react';

import type { InspectorBranchEvaluation } from '../core/inspector/types';
import { getColorForEdge } from '../core/rendering/theme';
import { useMapContext } from './map/MapContext';

interface InspectorPanelProps {
  selectedNodeId: string | null;
  nextNodeId: string | undefined;
  onClose: () => void;
  selectedAlternativeTargetId: string | null;
  setSelectedAlternativeTargetId: (id: string | null) => void;
}

/**
 * Renders a comparison breakdown of the chosen routing path edge versus alternative outgoing edges
 * from the selected node, detailing speed modifications, comfort ratings, flat penalties, and restriction statuses.
 */
export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedNodeId,
  nextNodeId,
  onClose,
  selectedAlternativeTargetId,
  setSelectedAlternativeTargetId,
}) => {
  const { inspectorBranches } = useMapContext();
  const evaluations = inspectorBranches;
  const chosenEdge = evaluations.find((ev) => ev.targetId === nextNodeId);
  const alternativeEdges = evaluations.filter((ev) => ev.targetId !== nextNodeId);

  const renderEdgeDetails = (ev: InspectorBranchEvaluation, isChosen: boolean) => {
    const hasSpeedReduction = ev.effectiveSpeedKmh < ev.baseSpeedKmh;
    const isLockedAlternative = ev.targetId === selectedAlternativeTargetId;
    const color = getColorForEdge(ev.matchedSign, ev.matchedRoad);

    return (
      <div
        key={ev.targetId}
        className={`ciclista-card inspector-edge-card ${isChosen ? 'chosen' : ''} ${
          isLockedAlternative ? 'locked-alt' : ''
        }`}
        onClick={() => {
          if (!isChosen) {
            setSelectedAlternativeTargetId(isLockedAlternative ? null : ev.targetId);
          }
        }}
      >
        <div className="inspector-edge-header">
          <div>
            <div className="inspector-edge-title">
              {/* eslint-disable-next-line react/forbid-dom-props -- Dynamic edge rendering color computed dynamically at runtime from road classification and traffic signs */}
              <span className="inspector-color-dot" style={{ backgroundColor: color }} />
              {ev.name}
            </div>
            <div className="inspector-edge-sub">
              To node: <span className="font-mono">{ev.targetId}</span>
            </div>
          </div>
          <span className={`inspector-badge ${isChosen ? 'chosen' : ''}`}>
            {isChosen ? 'Chosen' : 'Alternative'}
          </span>
        </div>

        <div className="inspector-grid">
          <div>
            <span className="text-secondary">Highway:</span>{' '}
            <code className="inspector-code">{ev.highway}</code>
          </div>
          <div>
            <span className="text-secondary">Surface:</span>{' '}
            <span className="font-medium">{ev.surface}</span>
          </div>
          <div>
            <span className="text-secondary">Base Speed:</span>{' '}
            <span className="font-medium">{ev.baseSpeedKmh.toFixed(1)} km/h</span>
          </div>
          <div>
            <span className="text-secondary">Effective Speed:</span>{' '}
            <span className={`font-medium ${hasSpeedReduction ? 'badge-signal' : ''}`}>
              {ev.effectiveSpeedKmh.toFixed(1)} km/h
            </span>
          </div>
          <div>
            <span className="text-secondary">Distance:</span>{' '}
            <span className="font-medium">{Math.round(ev.distance)} m</span>
          </div>
          <div>
            <span className="text-secondary">Display Cost:</span>{' '}
            <span className="font-medium">{Math.round(ev.displayCostSeconds)}s</span>
          </div>
          <div>
            <span className="text-secondary">Comfort Rating:</span>{' '}
            <span className="font-medium">{ev.comfort}</span>
          </div>
          <div>
            <span className="text-secondary">Routing Weight:</span>{' '}
            <span className="font-medium">{ev.routingWeight.toFixed(1)}</span>
          </div>
        </div>

        {ev.rulePenalties && ev.rulePenalties.length > 0 ? (
          <div className="inspector-penalties">
            {ev.rulePenalties.map((penalty, index) => {
              const badgeClass =
                penalty.type === 'restriction'
                  ? 'badge badge-signal'
                  : penalty.type === 'node_delay'
                    ? 'badge badge-bike'
                    : 'badge';

              return (
                <span key={index} className={badgeClass}>
                  {penalty.name}: +{Math.round(penalty.value)}s
                </span>
              );
            })}
          </div>
        ) : (
          (ev.matchedSign ||
            ev.flatPenaltySeconds > 0 ||
            ev.isRestricted ||
            ev.turnPenaltySeconds > 0 ||
            ev.nodeDelaySeconds > 0) && (
            <div className="inspector-penalties">
              {ev.matchedSign && <span className="badge">Sign: {ev.matchedSign}</span>}
              {ev.flatPenaltySeconds > 0 && (
                <span className="badge badge-signal">
                  Surface Penalty: +{Math.round(ev.flatPenaltySeconds)}s
                </span>
              )}
              {ev.turnPenaltySeconds > 0 && (
                <span className="badge">Turn Penalty: +{Math.round(ev.turnPenaltySeconds)}s</span>
              )}
              {ev.nodeDelaySeconds > 0 && (
                <span className="badge badge-bike">
                  {ev.nodeDelayType === 'signal' && 'Traffic Signal Delay'}
                  {ev.nodeDelayType === 'yield' && 'Yield Delay'}
                  {ev.nodeDelayType === 'stop' && 'Stop Sign Delay'}
                  {ev.nodeDelayType === 'crossing' && 'Crossing Delay'}
                  {ev.nodeDelayType === 'custom' && 'Custom Override Delay'}
                  {!ev.nodeDelayType && 'Intersection Delay'}: +{Math.round(ev.nodeDelaySeconds)}s
                </span>
              )}
              {ev.isRestricted && (
                <span className="badge badge-signal">
                  {ev.restrictionReason === 'footway_not_bicycle_frei'
                    ? 'Bicycles Prohibited (Footway)'
                    : 'Bicycle Restricted'}
                </span>
              )}
            </div>
          )
        )}
      </div>
    );
  };

  const selectedEval = evaluations.find((ev) => ev.targetId === selectedAlternativeTargetId);

  const renderComparisonCard = () => {
    if (!selectedEval) return null;

    const chosenRemainingDuration =
      selectedEval.chosenRemainingDuration ?? chosenEdge?.chosenRemainingDuration ?? 0;
    const chosenRemainingDistance =
      selectedEval.chosenRemainingDistance ?? chosenEdge?.chosenRemainingDistance ?? 0;
    const chosenRemainingSignals =
      selectedEval.chosenRemainingSignals ?? chosenEdge?.chosenRemainingSignals ?? 0;

    const timeDiff = Math.round(
      (selectedEval.altDurationSeconds ?? selectedEval.displayCostSeconds) -
        chosenRemainingDuration,
    );
    const distDiff = Math.round(
      (selectedEval.altDistanceMeters ?? selectedEval.distance) - chosenRemainingDistance,
    );
    const signalsDiff = (selectedEval.altSignalCount ?? 0) - chosenRemainingSignals;

    const timeSign = timeDiff >= 0 ? `+${timeDiff}` : `${timeDiff}`;
    const distSign = distDiff >= 0 ? `+${distDiff}` : `${distDiff}`;
    const signalsSign = signalsDiff >= 0 ? `+${signalsSign}` : `${signalsSign}`;

    return (
      <div className="ciclista-card inspector-compare-card">
        <div className="inspector-header-row">
          <span className="font-medium">Comparing paths to destination</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAlternativeTargetId(null);
            }}
            className="inspector-close-btn"
            title="Clear comparison"
          >
            &times;
          </button>
        </div>
        <div className="inspector-title-sub">
          Chosen remaining vs <strong>{selectedEval.name}</strong> alternative:
        </div>
        <div className="inspector-compare-grid">
          <div className="inspector-compare-col">
            <div className="inspector-compare-lbl">Time Diff</div>
            <div className="inspector-compare-val">{timeSign}s</div>
          </div>
          <div className="inspector-compare-col">
            <div className="inspector-compare-lbl">Dist Diff</div>
            <div className="inspector-compare-val">{distSign}m</div>
          </div>
          <div>
            <div className="inspector-compare-lbl">Signals Diff</div>
            <div className="inspector-compare-val">{signalsSign}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderLegend = () => {
    return (
      <div className="inspector-legend">
        <div className="inspector-legend-title">Map Inspector Legend</div>
        <div className="inspector-legend-grid">
          <div className="inspector-legend-item">
            <span className="legend-color-bar legend-color-bar--safe" />
            <span>Safe / Segregated Path</span>
          </div>
          <div className="inspector-legend-item">
            <span className="legend-color-bar legend-color-bar--shared" />
            <span>Acceptable / Shared Path</span>
          </div>
          <div className="inspector-legend-item">
            <span className="legend-color-bar legend-color-bar--primary" />
            <span>Primary / Mixed Traffic</span>
          </div>
          <div className="inspector-legend-item">
            <span className="legend-color-bar legend-color-bar--dismount" />
            <span>Dismount / Pedestrian</span>
          </div>
          <div className="inspector-legend-item">
            <span className="inspector-legend-icon-emoji">🚦</span>
            <span>Traffic Light</span>
          </div>
          <div className="inspector-legend-item">
            <span className="inspector-legend-icon-emoji">🛑</span>
            <span>Stop Sign</span>
          </div>
          <div className="inspector-legend-item">
            <span className="inspector-legend-icon-emoji">⚠️</span>
            <span>Yield Sign</span>
          </div>
          <div
            className="inspector-legend-item"
            title="Priority or marked crossings where yielding is mandatory. Informal or unmarked crossings are excluded."
          >
            <span className="inspector-legend-icon-emoji">🚸</span>
            <span>Crossing</span>
          </div>
          <div className="inspector-legend-item inspector-legend-item--full">
            <span className="inspector-legend-icon-emoji">⬆</span>
            <span>Sharp Turn Direction Cue (rotates relative to map)</span>
          </div>
          <div className="inspector-legend-note">
            * 🚸 denotes priority/marked crossings where yielding is mandatory. Informal or unmarked
            crossings are excluded.
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ciclista-card inspector-panel">
      <div className="inspector-header-row">
        <h2 className="ciclista-label">Node Inspector</h2>
        {selectedNodeId && (
          <button onClick={onClose} className="inspector-close-btn" title="Close Inspector">
            &times;
          </button>
        )}
      </div>

      {selectedNodeId ? (
        <>
          <div className="inspector-title-sub">
            Selected Node ID: <span className="font-mono">{selectedNodeId}</span>
          </div>

          {renderComparisonCard()}

          <div className="inspector-scroll-area inspector-scroll-container">
            {chosenEdge && renderEdgeDetails(chosenEdge, true)}

            {alternativeEdges.map((ev) => renderEdgeDetails(ev, false))}

            {evaluations.length === 0 && (
              <div className="inspector-empty-msg">No outgoing edges from this node.</div>
            )}
          </div>
        </>
      ) : (
        <div className="inspector-empty-msg">
          Select an intersection node on the map to inspect alternative routing decisions.
        </div>
      )}

      {renderLegend()}
    </div>
  );
};
