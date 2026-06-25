import React from 'react';

import { getColorForEdge } from '../core/inspector/mapper';
import type { AlternativeEdgeEvaluation } from '../core/router/types';

interface InspectorPanelProps {
  selectedNodeId: string | null;
  evaluations: AlternativeEdgeEvaluation[];
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
  evaluations,
  nextNodeId,
  onClose,
  selectedAlternativeTargetId,
  setSelectedAlternativeTargetId,
}) => {
  const chosenEdge = evaluations.find((ev) => ev.targetId === nextNodeId);
  const alternativeEdges = evaluations.filter((ev) => ev.targetId !== nextNodeId);

  const renderEdgeDetails = (ev: AlternativeEdgeEvaluation, isChosen: boolean) => {
    const hasSpeedReduction = ev.effectiveSpeedKmh < ev.baseSpeedKmh;
    const isLockedAlternative = ev.targetId === selectedAlternativeTargetId;
    const color = getColorForEdge(ev.matchedSign, ev.matchedRoad);

    return (
      <div
        key={ev.targetId}
        className="ciclista-card"
        onClick={() => {
          if (!isChosen) {
            setSelectedAlternativeTargetId(isLockedAlternative ? null : ev.targetId);
          }
        }}
        style={{
          padding: '12px',
          border: isChosen
            ? '1.5px solid var(--ciclista-color-brand-secondary)'
            : isLockedAlternative
              ? '1.5px solid #ef4444'
              : '1px solid var(--ciclista-glass-border-base)',
          background: isChosen
            ? 'rgba(20, 184, 166, 0.05)'
            : isLockedAlternative
              ? 'rgba(239, 68, 68, 0.05)'
              : 'var(--ciclista-color-surface-elevated)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          cursor: isChosen ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'var(--ciclista-color-text-primary)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  marginRight: '6px',
                  flexShrink: 0,
                }}
              />
              {ev.name}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--ciclista-color-text-secondary)',
                marginTop: '2px',
              }}
            >
              To node: <span style={{ fontFamily: 'monospace' }}>{ev.targetId}</span>
            </div>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              background: isChosen
                ? 'var(--ciclista-color-success-bg)'
                : 'var(--ciclista-color-surface-tertiary)',
              border: isChosen
                ? '1px solid var(--ciclista-color-success-border)'
                : '1px solid var(--ciclista-glass-border-base)',
              color: isChosen
                ? 'var(--ciclista-color-brand-secondary)'
                : 'var(--ciclista-color-text-secondary)',
            }}
          >
            {isChosen ? 'Chosen' : 'Alternative'}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            fontSize: '0.75rem',
            marginTop: '4px',
            borderTop: '1px solid var(--ciclista-glass-border-base)',
            paddingTop: '8px',
          }}
        >
          <div>
            <span style={{ color: 'var(--ciclista-color-text-secondary)' }}>Highway:</span>{' '}
            <code
              style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '1px 4px',
                borderRadius: '3px',
              }}
            >
              {ev.highway}
            </code>
          </div>
          <div>
            <span style={{ color: 'var(--ciclista-color-text-secondary)' }}>Surface:</span>{' '}
            <span style={{ fontWeight: 500 }}>{ev.surface}</span>
          </div>
          <div>
            <span style={{ color: 'var(--ciclista-color-text-secondary)' }}>Base Speed:</span>{' '}
            <span style={{ fontWeight: 500 }}>{ev.baseSpeedKmh.toFixed(1)} km/h</span>
          </div>
          <div>
            <span style={{ color: 'var(--ciclista-color-text-secondary)' }}>Effective Speed:</span>{' '}
            <span
              style={{
                fontWeight: 500,
                color: hasSpeedReduction ? 'var(--ciclista-color-danger-text)' : 'inherit',
              }}
            >
              {ev.effectiveSpeedKmh.toFixed(1)} km/h
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--ciclista-color-text-secondary)' }}>Distance:</span>{' '}
            <span style={{ fontWeight: 500 }}>{Math.round(ev.distance)} m</span>
          </div>
          <div>
            <span style={{ color: 'var(--ciclista-color-text-secondary)' }}>Display Cost:</span>{' '}
            <span style={{ fontWeight: 500 }}>{Math.round(ev.displayCostSeconds)}s</span>
          </div>
          <div>
            <span style={{ color: 'var(--ciclista-color-text-secondary)' }}>Comfort Rating:</span>{' '}
            <span style={{ fontWeight: 500 }}>{ev.comfort}</span>
          </div>
          <div>
            <span style={{ color: 'var(--ciclista-color-text-secondary)' }}>Routing Weight:</span>{' '}
            <span style={{ fontWeight: 500 }}>{ev.routingWeight.toFixed(1)}</span>
          </div>
        </div>

        {ev.rulePenalties && ev.rulePenalties.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              marginTop: '4px',
              borderTop: '1px solid var(--ciclista-glass-border-base)',
              paddingTop: '6px',
            }}
          >
            {ev.rulePenalties.map((penalty, index) => {
              let bg = 'rgba(234, 179, 8, 0.1)';
              let border = '1px solid rgba(234, 179, 8, 0.2)';
              let color = 'var(--ciclista-color-brand-hover)';

              if (penalty.type === 'restriction') {
                bg = 'var(--ciclista-color-danger-bg)';
                border = '1px solid var(--ciclista-color-danger-border)';
                color = 'var(--ciclista-color-danger-text)';
              } else if (penalty.type === 'node_delay') {
                bg = 'rgba(59, 130, 246, 0.1)';
                border = '1px solid rgba(59, 130, 246, 0.2)';
                color = '#60a5fa';
              } else if (penalty.type === 'surface') {
                bg = 'rgba(244, 63, 94, 0.1)';
                border = '1px solid rgba(244, 63, 94, 0.2)';
                color = 'var(--ciclista-color-brand-danger)';
              } else if (penalty.type === 'road_class') {
                bg = 'rgba(99, 102, 241, 0.1)';
                border = '1px solid rgba(99, 102, 241, 0.2)';
                color = 'var(--ciclista-color-brand-hover)';
              } else if (penalty.type === 'service') {
                bg = 'rgba(168, 85, 247, 0.1)';
                border = '1px solid rgba(168, 85, 247, 0.2)';
                color = '#c084fc';
              }

              return (
                <span
                  key={index}
                  style={{
                    fontSize: '0.65rem',
                    background: bg,
                    border: border,
                    color: color,
                    padding: '1px 5px',
                    borderRadius: '3px',
                    fontWeight: penalty.type === 'restriction' ? 'bold' : 'normal',
                  }}
                >
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
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                marginTop: '4px',
                borderTop: '1px solid var(--ciclista-glass-border-base)',
                paddingTop: '6px',
              }}
            >
              {ev.matchedSign && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    color: 'var(--ciclista-color-brand-hover)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}
                >
                  Sign: {ev.matchedSign}
                </span>
              )}
              {ev.flatPenaltySeconds > 0 && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    color: 'var(--ciclista-color-brand-danger)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}
                >
                  Surface Penalty: +{Math.round(ev.flatPenaltySeconds)}s
                </span>
              )}
              {ev.turnPenaltySeconds > 0 && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.2)',
                    color: 'var(--ciclista-color-brand-hover)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}
                >
                  Turn Penalty: +{Math.round(ev.turnPenaltySeconds)}s
                </span>
              )}
              {ev.nodeDelaySeconds > 0 && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}
                >
                  {ev.nodeDelayType === 'signal' && 'Traffic Signal Delay'}
                  {ev.nodeDelayType === 'yield' && 'Yield Delay'}
                  {ev.nodeDelayType === 'stop' && 'Stop Sign Delay'}
                  {ev.nodeDelayType === 'crossing' && 'Crossing Delay'}
                  {ev.nodeDelayType === 'custom' && 'Custom Override Delay'}
                  {!ev.nodeDelayType && 'Intersection Delay'}: +{Math.round(ev.nodeDelaySeconds)}s
                </span>
              )}
              {ev.isRestricted && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'var(--ciclista-color-danger-bg)',
                    border: '1px solid var(--ciclista-color-danger-border)',
                    color: 'var(--ciclista-color-danger-text)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    fontWeight: 'bold',
                  }}
                >
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

    const timeColor = timeDiff > 0 ? '#ef4444' : timeDiff < 0 ? '#10b981' : 'inherit';
    const distColor = distDiff > 0 ? '#ef4444' : distDiff < 0 ? '#10b981' : 'inherit';
    const signalsColor = signalsDiff > 0 ? '#ef4444' : signalsDiff < 0 ? '#10b981' : 'inherit';

    const timeSign = timeDiff >= 0 ? `+${timeDiff}` : `${timeDiff}`;
    const distSign = distDiff >= 0 ? `+${distDiff}` : `${distDiff}`;
    const signalsSign = signalsDiff >= 0 ? `+${signalsDiff}` : `${signalsDiff}`;

    return (
      <div
        className="ciclista-card"
        style={{
          padding: '12px',
          border: '1.5px solid #ef4444',
          background: 'rgba(239, 68, 68, 0.04)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#ef4444' }}>
            Comparing paths to destination
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAlternativeTargetId(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ciclista-color-text-secondary)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              padding: '0 4px',
            }}
            title="Clear comparison"
          >
            &times;
          </button>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--ciclista-color-text-secondary)' }}>
          Chosen remaining vs <strong style={{ color: '#ef4444' }}>{selectedEval.name}</strong>{' '}
          alternative:
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px',
            textAlign: 'center',
            marginTop: '4px',
          }}
        >
          <div style={{ borderRight: '1px solid var(--ciclista-glass-border-base)' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--ciclista-color-text-secondary)' }}>
              Time Diff
            </div>
            <div
              style={{
                fontWeight: 'bold',
                color: timeColor,
                fontSize: '0.85rem',
                marginTop: '2px',
              }}
            >
              {timeSign}s
            </div>
          </div>
          <div style={{ borderRight: '1px solid var(--ciclista-glass-border-base)' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--ciclista-color-text-secondary)' }}>
              Dist Diff
            </div>
            <div
              style={{
                fontWeight: 'bold',
                color: distColor,
                fontSize: '0.85rem',
                marginTop: '2px',
              }}
            >
              {distSign}m
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--ciclista-color-text-secondary)' }}>
              Signals Diff
            </div>
            <div
              style={{
                fontWeight: 'bold',
                color: signalsColor,
                fontSize: '0.85rem',
                marginTop: '2px',
              }}
            >
              {signalsSign}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLegend = () => {
    return (
      <div
        style={{
          borderTop: '1px solid var(--ciclista-glass-border-base)',
          paddingTop: '12px',
          marginTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.8rem',
            color: 'var(--ciclista-color-text-primary)',
          }}
        >
          Map Inspector Legend
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            fontSize: '0.7rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: '#10b981',
              }}
            />
            <span>Safe / Segregated Path</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: '#3b82f6',
              }}
            />
            <span>Acceptable / Shared Path</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: '#ef4444',
              }}
            />
            <span>Primary / Mixed Traffic</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: '#8b5cf6',
              }}
            />
            <span>Dismount / Pedestrian</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>🚦</span>
            <span>Traffic Light</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>🛑</span>
            <span>Stop Sign</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>⚠️</span>
            <span>Yield Sign</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>🚸</span>
            <span>Crossing</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', gridColumn: 'span 2' }}>
            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>⬆</span>
            <span>Sharp Turn Direction Cue (rotates relative to map)</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="ciclista-card"
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginTop: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '0.95rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Node Inspector
        </h2>
        {selectedNodeId && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ciclista-color-text-secondary)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '2px 6px',
            }}
            title="Close Inspector"
          >
            &times;
          </button>
        )}
      </div>

      {selectedNodeId ? (
        <>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--ciclista-color-text-secondary)',
              marginBottom: '4px',
            }}
          >
            Selected Node ID: <span style={{ fontFamily: 'monospace' }}>{selectedNodeId}</span>
          </div>

          {renderComparisonCard()}

          <div
            className="inspector-scroll-area"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: '320px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {chosenEdge && renderEdgeDetails(chosenEdge, true)}

            {alternativeEdges.map((ev) => renderEdgeDetails(ev, false))}

            {evaluations.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--ciclista-color-text-muted)',
                }}
              >
                No outgoing edges from this node.
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--ciclista-color-text-secondary)',
            textAlign: 'center',
            padding: '8px 0',
          }}
        >
          Select an intersection node on the map to inspect alternative routing decisions.
        </div>
      )}

      {renderLegend()}
    </div>
  );
};
