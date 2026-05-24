import { Check, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef, useState } from 'react';

import type { GraphNode } from '../../core/graph/types';

interface NodePopupProps {
  map: maplibregl.Map;
  selectedNode: GraphNode | null;
  onNodeSelect: (node: GraphNode | null) => void;
  customNodeDelays: Map<string, number>;
  customNodeNotes: Map<string, string>;
  onSaveNodeOverride: (nodeId: string, delay: number, notes: string) => void;
  onClearNodeOverride: (nodeId: string) => void;
  setDockExpanded: (expanded: boolean) => void;
}

/**
 *
 */
export const NodePopup: React.FC<NodePopupProps> = ({
  map,
  selectedNode,
  onNodeSelect,
  customNodeDelays,
  customNodeNotes,
  onSaveNodeOverride,
  onClearNodeOverride,
  setDockExpanded,
}) => {
  const getDefaultBaseDelay = (tags: Record<string, string>): number => {
    if (tags.highway === 'traffic_signals' || tags.crossing === 'traffic_signals') {
      return 15;
    }
    if (tags.highway === 'give_way') {
      return 3;
    }
    if (tags.highway === 'stop') {
      return 8;
    }
    if (tags.highway === 'crossing' || tags.crossing) {
      return 3;
    }
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

  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(() => {
    if (!selectedNode) return null;
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
    if (tags.highway === 'traffic_signals' || tags.crossing === 'traffic_signals') {
      return 'signal';
    }
    if (tags.highway === 'give_way') {
      return 'yield';
    }
    if (tags.highway === 'stop') {
      return 'stop';
    }
    return 'crossing';
  };

  const getControlTypeLabel = (tags: Record<string, string>) => {
    const type = getControlType(tags);
    switch (type) {
      case 'signal':
        return '🚦 Traffic Signal';
      case 'yield':
        return '⚠️ Yield Sign (Give Way)';
      case 'stop':
        return '🛑 Stop Sign';
      case 'crossing':
        return '🚶 Pedestrian Crossing';
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
    if (!selectedNode) return;

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

      <div className="form-group" style={{ marginBottom: '10px' }}>
        <label className="form-label" style={{ fontSize: '0.65rem' }}>
          Wait Penalty: {nodeDelay} seconds
        </label>
        <div className="slider-container">
          <input
            type="range"
            min="0"
            max="180"
            step="5"
            className="slider"
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
                    ? 'var(--accent-secondary)'
                    : 'rgba(255, 255, 255, 0.08)',
                color: nodeDelay === preset.value ? '#000000' : 'var(--text-primary)',
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

      <div className="form-group" style={{ marginBottom: '10px' }}>
        <label className="form-label" style={{ fontSize: '0.65rem' }}>
          Custom Notes
        </label>
        <input
          className="input-text"
          type="text"
          placeholder="e.g. Constant bus priority request"
          value={nodeNotes}
          onChange={(e) => setNodeNotes(e.target.value)}
          style={{ padding: '6px 8px', fontSize: '0.8rem' }}
        />
      </div>

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
