import { AlertTriangle, Check, Footprints, Octagon, TrafficCone, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { getTurnDetails } from '../../core/common/geometry';
import type { SemanticTurnType } from '../../core/config';
import { mapOSMNodeToControl } from '../../core/router/rules';
import { useMapContext } from './MapContext';

function getBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  brng = (brng + 360) % 360;
  return brng;
}

function getCompassDirection(bearing: number): string {
  const directions = [
    'Northbound',
    'Northeastbound',
    'Eastbound',
    'Southeastbound',
    'Southbound',
    'Southwestbound',
    'Westbound',
    'Northwestbound',
  ];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Glassmorphic popup modal that displays details for a selected street intersection node,
 * allowing users to set custom delay values, override presets, and save descriptive notes.
 */
export const NodePopup: React.FC = () => {
  const {
    map,
    selectedNode,
    onNodeSelect,
    customNodeDelays,
    customNodeNotes,
    customNodeTurns,
    onSaveNodeOverride,
    onSaveNodeTurns,
    onClearNodeOverride,
    setDockExpanded,
    graph,
  } = useMapContext();

  const getDefaultBaseDelay = (tags: Record<string, string>): number => {
    const controlType = mapOSMNodeToControl(tags);
    if (controlType === 'signal') return 15;
    if (controlType === 'yield') return 3;
    if (controlType === 'stop') return 8;
    if (controlType === 'crossing') return 3;
    return 0;
  };

  // State initialization directly from selectedNode
  const [nodeDelay, setNodeDelay] = useState<number>(() => {
    if (!selectedNode) return 30;
    return customNodeDelays.get(selectedNode.id) ?? getDefaultBaseDelay(selectedNode.tags);
  });

  const [nodeNotes, setNodeNotes] = useState<string>(() => {
    if (!selectedNode) return '';
    return customNodeNotes.get(selectedNode.id) ?? '';
  });

  const [nodeTurns, setNodeTurns] = useState<Record<string, SemanticTurnType>>(() => {
    if (!selectedNode || !customNodeTurns) return {};
    return customNodeTurns.get(selectedNode.id) ?? {};
  });

  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(() => {
    if (!selectedNode || !map) return null;
    const pos = map.project([selectedNode.lng, selectedNode.lat]);
    return { x: pos.x, y: pos.y };
  });

  const onSaveNodeOverrideRef = useRef(onSaveNodeOverride);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onClearNodeOverrideRef = useRef(onClearNodeOverride);

  useEffect(() => {
    onSaveNodeOverrideRef.current = onSaveNodeOverride;
  }, [onSaveNodeOverride]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    onClearNodeOverrideRef.current = onClearNodeOverride;
  }, [onClearNodeOverride]);

  const getControlType = (
    tags: Record<string, string>,
  ): 'signal' | 'yield' | 'stop' | 'crossing' => {
    return mapOSMNodeToControl(tags) || 'crossing';
  };

  const getControlTypeLabel = (tags: Record<string, string>): React.ReactNode => {
    const type = getControlType(tags);
    switch (type) {
      case 'signal':
        return (
          <span
            className="control-type-label"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <TrafficCone size={12} aria-label="Traffic Light Icon" />
            Traffic Signal
          </span>
        );
      case 'yield':
        return (
          <span
            className="control-type-label"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <AlertTriangle size={12} aria-label="Yield Sign Icon" />
            Yield Sign (Give Way)
          </span>
        );
      case 'stop':
        return (
          <span
            className="control-type-label"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Octagon size={12} aria-label="Stop Sign Icon" />
            Stop Sign
          </span>
        );
      case 'crossing':
        return (
          <span
            className="control-type-label"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Footprints size={12} aria-label="Pedestrian Crossing Icon" />
            Pedestrian Crossing
          </span>
        );
    }
  };

  const getPresets = (
    type: 'signal' | 'yield' | 'stop' | 'crossing',
  ): { label: string; value: number }[] => {
    switch (type) {
      case 'signal':
        return [
          { label: 'Always Green', value: 0 },
          { label: 'Standard (15s)', value: 15 },
          { label: 'Slow (30s)', value: 30 },
          { label: 'Major (60s)', value: 60 },
        ];
      case 'yield':
        return [
          { label: 'Clear', value: 0 },
          { label: 'Standard (3s)', value: 3 },
          { label: 'Heavy (15s)', value: 15 },
        ];
      case 'stop':
        return [
          { label: 'Rolling (2s)', value: 2 },
          { label: 'Standard (8s)', value: 8 },
          { label: 'Busy (20s)', value: 20 },
        ];
      case 'crossing':
        return [
          { label: 'Clear', value: 0 },
          { label: 'Standard (3s)', value: 3 },
          { label: 'Busy (15s)', value: 15 },
        ];
    }
  };

  // Collapse bottom controls dock on mounting
  useEffect(() => {
    const timer = setTimeout(() => {
      setDockExpanded(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [setDockExpanded]);

  // Project map coordinates on map move/zoom
  useEffect(() => {
    if (!map || !selectedNode) return;

    const updatePosition = () => {
      const pos = map.project([selectedNode.lng, selectedNode.lat]);
      setPopupPos({ x: pos.x, y: pos.y });
    };

    map.on('move', updatePosition);
    map.on('zoom', updatePosition);

    return () => {
      map.off('move', updatePosition);
      map.off('zoom', updatePosition);
    };
  }, [map, selectedNode]);

  const handleSaveNode = () => {
    if (selectedNode && onSaveNodeOverrideRef.current) {
      onSaveNodeOverrideRef.current(selectedNode.id, nodeDelay, nodeNotes);
      if (onSaveNodeTurns) {
        onSaveNodeTurns(selectedNode.id, nodeTurns);
      }
      if (onNodeSelectRef.current) {
        onNodeSelectRef.current(null);
      }
    }
  };

  const handleResetNode = () => {
    if (selectedNode && onClearNodeOverrideRef.current) {
      onClearNodeOverrideRef.current(selectedNode.id);
      if (onNodeSelectRef.current) {
        onNodeSelectRef.current(null);
      }
    }
  };

  // Precompute maneuvers
  const maneuvers = React.useMemo(() => {
    const list: {
      fromNodeId: string;
      fromStreetName: string;
      toNodeId: string;
      toStreetName: string;
      direction: 'left' | 'right' | 'u-turn' | 'straight';
      incomingDir: string;
      outgoingDir: string;
    }[] = [];

    if (graph && selectedNode) {
      const currentNodeId = selectedNode.id;
      const currentNodeEntry = graph.nodes.get(currentNodeId);
      if (currentNodeEntry) {
        const outgoingEdges = currentNodeEntry.edges;

        const incomingEdges: { sourceId: string; streetName: string }[] = [];
        for (const [sourceId, entry] of graph.nodes.entries()) {
          if (sourceId === currentNodeId) continue;
          for (const edge of entry.edges) {
            if (edge.target === currentNodeId) {
              incomingEdges.push({
                sourceId,
                streetName: edge.name || edge.tags.name || 'Unnamed Street',
              });
            }
          }
        }

        for (const incoming of incomingEdges) {
          for (const outgoing of outgoingEdges) {
            if (incoming.sourceId === outgoing.target) continue;

            const pNode = graph.nodes.get(incoming.sourceId)?.node;
            const nNode = graph.nodes.get(outgoing.target)?.node;

            if (pNode && nNode) {
              const details = getTurnDetails(pNode, selectedNode, nNode);
              const incomingBearing = getBearing(pNode, selectedNode);
              const outgoingBearing = getBearing(selectedNode, nNode);
              list.push({
                fromNodeId: incoming.sourceId,
                fromStreetName: incoming.streetName,
                toNodeId: outgoing.target,
                toStreetName: outgoing.name || outgoing.tags.name || 'Unnamed Street',
                direction: details.direction,
                incomingDir: getCompassDirection(incomingBearing),
                outgoingDir: getCompassDirection(outgoingBearing),
              });
            }
          }
        }
      }
    }
    return list;
  }, [graph, selectedNode]);

  if (!selectedNode || !popupPos) return null;

  const controlType = getControlType(selectedNode.tags);

  return (
    <div
      className="map-popup"
      style={{
        position: 'absolute',
        left: `${popupPos.x}px`,
        top: `${popupPos.y}px`,
        transform: 'translate(-50%, -100%) translateY(-15px)',
        zIndex: 10,
        maxHeight: '400px',
        overflowY: 'auto',
        width: '300px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Configure Control Point
        </h3>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
          }}
          onClick={() => onNodeSelect(null)}
        >
          <X size={14} />
        </button>
      </div>

      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          marginBottom: '8px',
          lineHeight: '1.4',
        }}
      >
        <strong>Type:</strong> {getControlTypeLabel(selectedNode.tags)}
        <br />
        <strong>ID:</strong> {selectedNode.id}
        <br />
        <strong>OSM Name:</strong> {selectedNode.tags.name || 'Unnamed Crossing'}
      </div>

      <div className="ciclista-form-group" style={{ marginBottom: '10px' }}>
        <label className="ciclista-label" style={{ fontSize: '0.65rem' }}>
          Wait Penalty: {nodeDelay} seconds
        </label>
        <div className="ciclista-slider-container">
          <input
            type="range"
            min="0"
            max="180"
            step="5"
            className="ciclista-slider"
            value={nodeDelay}
            onChange={(e) => setNodeDelay(parseInt(e.target.value))}
          />
        </div>
        {/* Presets buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {getPresets(controlType).map((preset) => (
            <button
              key={preset.label}
              type="button"
              style={{
                background:
                  nodeDelay === preset.value
                    ? 'var(--ciclista-color-brand-secondary)'
                    : 'rgba(255, 255, 255, 0.08)',
                color:
                  nodeDelay === preset.value ? '#000000' : 'var(--ciclista-color-text-primary)',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.62rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setNodeDelay(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ciclista-form-group" style={{ marginBottom: '10px' }}>
        <label className="ciclista-label" style={{ fontSize: '0.65rem' }}>
          Custom Notes
        </label>
        <input
          className="ciclista-input"
          type="text"
          placeholder="e.g. Constant bus priority request"
          value={nodeNotes}
          onChange={(e) => setNodeNotes(e.target.value)}
          style={{ padding: '6px 8px', fontSize: '0.8rem' }}
        />
      </div>

      {maneuvers.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div className="osm-tags-title" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
            Turn Overrides
          </div>
          <div
            style={{
              maxHeight: '150px',
              overflowY: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              background: 'rgba(0, 0, 0, 0.2)',
              padding: '4px',
            }}
          >
            {maneuvers.map((m) => {
              const compositeKey = `${m.fromNodeId}->${m.toNodeId}`;
              const activeVal = nodeTurns[compositeKey] || 'default';

              return (
                <div
                  key={compositeKey}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '6px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.68rem',
                    gap: '4px',
                  }}
                >
                  <div style={{ color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                    From <strong>{m.fromStreetName}</strong> ({m.incomingDir})
                    <br />
                    To <strong>{m.toStreetName}</strong> ({m.outgoingDir} -{' '}
                    {m.direction === 'left'
                      ? 'Left Turn'
                      : m.direction === 'right'
                        ? 'Right Turn'
                        : m.direction === 'u-turn'
                          ? 'U-Turn'
                          : 'Straight'}
                    )
                  </div>
                  <select
                    value={activeVal}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNodeTurns((prev) => {
                        const updated = { ...prev };
                        if (val === 'default') {
                          delete updated[compositeKey];
                        } else {
                          updated[compositeKey] = val as SemanticTurnType;
                        }
                        return updated;
                      });
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      padding: '2px 4px',
                      fontSize: '0.65rem',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="default" style={{ background: '#111' }}>
                      Default
                    </option>
                    <option value="left_turn" style={{ background: '#111' }}>
                      Direct Left Turn
                    </option>
                    <option value="right_turn" style={{ background: '#111' }}>
                      Direct Right Turn
                    </option>
                    <option value="green_arrow_right" style={{ background: '#111' }}>
                      Green Arrow Right Turn
                    </option>
                    <option value="indirect_left" style={{ background: '#111' }}>
                      Indirect Left Turn
                    </option>
                    <option value="u_turn" style={{ background: '#111' }}>
                      U-Turn
                    </option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsible/Scrollable OSM Info Section */}
      <div className="osm-tags-title" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
        OSM Tags
      </div>
      <div className="osm-tags-container">
        {Object.entries(selectedNode.tags).length > 0 ? (
          Object.entries(selectedNode.tags).map(([key, val]) => (
            <div key={key} className="osm-tag-row">
              <span className="osm-tag-key">{key}</span>
              <span className="osm-tag-val">{String(val)}</span>
            </div>
          ))
        ) : (
          <div style={{ padding: '6px 8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No tags available
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          className="ciclista-btn ciclista-btn--primary"
          style={{
            flex: 1,
            padding: '6px var(--spacing-sm)',
            fontSize: '0.8rem',
            height: '32px',
          }}
          onClick={handleSaveNode}
        >
          <Check size={14} style={{ marginRight: '4px' }} />
          Save
        </button>
        {customNodeDelays.has(selectedNode.id) && (
          <button
            className="ciclista-btn ciclista-btn--danger"
            style={{
              flex: 0.5,
              padding: '6px var(--spacing-sm)',
              fontSize: '0.8rem',
              height: '32px',
              color: 'var(--text-primary)',
              background: 'var(--accent-danger)',
            }}
            onClick={handleResetNode}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
