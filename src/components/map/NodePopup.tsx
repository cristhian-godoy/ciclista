import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { getBearing, getCompassDirection } from '../../core/common/geo';
import type { SemanticTurnType } from '../../core/config';
import { DEFAULT_RULES_CONFIG } from '../../core/config/defaults';
import { getIncomingEdges } from '../../core/graph/utils';
import { getTurnDetails, mapOSMNodeToControl } from '../../core/rules';
import { AlertTriangle, Check, Footprints, Octagon, TrafficCone, X } from '../common/Icon';
import { useMapContext } from './MapContext';
import { OsmTagTable } from './OsmTagTable';
import { type NodeManeuver, TurnOverridesForm } from './TurnOverridesForm';

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
    if (controlType === 'signal') return DEFAULT_RULES_CONFIG.nodeDelays.signalSeconds;
    if (controlType === 'yield') return DEFAULT_RULES_CONFIG.nodeDelays.yieldSeconds;
    if (controlType === 'stop') return DEFAULT_RULES_CONFIG.nodeDelays.stopSeconds;
    if (controlType === 'crossing') return DEFAULT_RULES_CONFIG.nodeDelays.crossingSeconds;
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
    if (!selectedNode || !map || typeof map.project !== 'function') return null;
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
          <span className="control-type-label strategy-label-badge">
            <TrafficCone size={12} aria-label="Traffic Light Icon" />
            Traffic Signal
          </span>
        );
      case 'yield':
        return (
          <span className="control-type-label strategy-label-badge">
            <AlertTriangle size={12} aria-label="Yield Sign Icon" />
            Yield Sign (Give Way)
          </span>
        );
      case 'stop':
        return (
          <span className="control-type-label strategy-label-badge">
            <Octagon size={12} aria-label="Stop Sign Icon" />
            Stop Sign
          </span>
        );
      case 'crossing':
        return (
          <span className="control-type-label strategy-label-badge">
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
    if (!map || !selectedNode || typeof map.project !== 'function') return;

    const updatePosition = () => {
      const pos = map.project([selectedNode.lng, selectedNode.lat]);
      setPopupPos({ x: pos.x, y: pos.y });
    };

    updatePosition();

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

  // Precompute maneuvers using O(1) indexed incoming edges and shared geo math
  const maneuvers = React.useMemo(() => {
    const list: NodeManeuver[] = [];

    if (graph && selectedNode) {
      const currentNodeId = selectedNode.id;
      const currentNodeEntry = graph.nodes.get(currentNodeId);
      if (currentNodeEntry) {
        const outgoingEdges = currentNodeEntry.edges;
        const incoming = getIncomingEdges(graph, currentNodeId);

        for (const inc of incoming) {
          const sourceId = inc.sourceId;
          const streetName = inc.edge.name || inc.edge.tags.name || 'Unnamed Street';

          for (const outgoing of outgoingEdges) {
            if (sourceId === outgoing.target) continue;

            const pNode = graph.nodes.get(sourceId)?.node;
            const nNode = graph.nodes.get(outgoing.target)?.node;

            if (pNode && nNode) {
              const details = getTurnDetails(pNode, selectedNode, nNode);
              const incomingBearing = getBearing(pNode, selectedNode);
              const outgoingBearing = getBearing(selectedNode, nNode);
              list.push({
                fromNodeId: sourceId,
                fromStreetName: streetName,
                toNodeId: outgoing.target,
                toStreetName: outgoing.name || outgoing.tags.name || 'Unnamed Street',
                direction: details.direction,
                incomingDir: getCompassDirection(incomingBearing, 'long'),
                outgoingDir: getCompassDirection(outgoingBearing, 'long'),
              });
            }
          }
        }
      }
    }
    return list;
  }, [graph, selectedNode]);

  const popupRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (popupRef.current && popupPos) {
      popupRef.current.style.left = `${popupPos.x}px`;
      popupRef.current.style.top = `${popupPos.y}px`;
    }
  }, [popupPos]);

  if (!selectedNode || !popupPos) return null;

  const controlType = getControlType(selectedNode.tags);

  return (
    <div ref={popupRef} className="map-popup" onClick={(e) => e.stopPropagation()}>
      <div className="popup-header-box">
        <h3 className="popup-title">Configure Control Point</h3>
        <button className="popup-close-btn" onClick={() => onNodeSelect(null)}>
          <X size={14} />
        </button>
      </div>

      <div className="popup-info-box">
        <strong>Type:</strong> {getControlTypeLabel(selectedNode.tags)}
        <br />
        <strong>ID:</strong> {selectedNode.id}
        <br />
        <strong>OSM Name:</strong> {selectedNode.tags.name || 'Unnamed Crossing'}
      </div>

      <div className="ciclista-form-group popup-form-group">
        <label className="ciclista-label popup-label-small">
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
        <div className="popup-preset-list">
          {getPresets(controlType).map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`popup-preset-btn ${
                nodeDelay === preset.value ? 'popup-preset-btn--active' : ''
              }`}
              onClick={() => setNodeDelay(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ciclista-form-group popup-form-group">
        <label className="ciclista-label popup-label-small">Custom Notes</label>
        <input
          className="ciclista-input popup-input-small"
          type="text"
          placeholder="e.g. Constant bus priority request"
          value={nodeNotes}
          onChange={(e) => setNodeNotes(e.target.value)}
        />
      </div>

      <TurnOverridesForm
        maneuvers={maneuvers}
        nodeTurns={nodeTurns}
        onTurnChange={(compositeKey, val) => {
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
      />

      <OsmTagTable tags={selectedNode.tags} />

      <div className="popup-actions-row">
        <button
          className="ciclista-btn ciclista-btn--primary popup-save-btn"
          onClick={handleSaveNode}
        >
          <Check size={14} className="badge-bike" />
          Save
        </button>
        {customNodeDelays.has(selectedNode.id) && (
          <button
            className="ciclista-btn ciclista-btn--danger popup-reset-btn"
            onClick={handleResetNode}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
