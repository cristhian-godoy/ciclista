import React from 'react';

import type { AlternativeEdgeEvaluation } from '../core/router/types';

interface InspectorPanelProps {
  selectedNodeId: string;
  evaluations: AlternativeEdgeEvaluation[];
  nextNodeId: string | undefined;
  onClose: () => void;
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
}) => {
  const chosenEdge = evaluations.find((ev) => ev.targetId === nextNodeId);
  const alternativeEdges = evaluations.filter((ev) => ev.targetId !== nextNodeId);

  const renderEdgeDetails = (ev: AlternativeEdgeEvaluation, isChosen: boolean) => {
    const hasSpeedReduction = ev.effectiveSpeedKmh < ev.baseSpeedKmh;

    return (
      <div
        key={ev.targetId}
        className={`ciclista-card`}
        style={{
          padding: '12px',
          border: isChosen
            ? '1.5px solid var(--ciclista-color-brand-secondary)'
            : '1px solid var(--ciclista-glass-border-base)',
          background: isChosen
            ? 'rgba(20, 184, 166, 0.05)'
            : 'var(--ciclista-color-surface-elevated)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'var(--ciclista-color-text-primary)',
              }}
            >
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

        {(ev.matchedSign ||
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
        )}
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
      </div>

      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--ciclista-color-text-secondary)',
          marginBottom: '4px',
        }}
      >
        Selected Node ID: <span style={{ fontFamily: 'monospace' }}>{selectedNodeId}</span>
      </div>

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
    </div>
  );
};
