import { ChevronDown, Sliders, TrafficCone } from 'lucide-react';
import React from 'react';

import { useMapContext } from './MapContext';

/**
 * Collapsible map overlay panel that controls the visibility of street networks,
 * bounding boxes, node markers, and traffic signal overlays.
 */
export const MapLayerDock: React.FC = () => {
  const { showMinorControls, setShowMinorControls, dockExpanded, setDockExpanded } =
    useMapContext();

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {dockExpanded ? (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '8px 12px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -4px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Map Layers
          </span>

          <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.15)' }} />

          <button
            style={{
              background: showMinorControls
                ? 'var(--accent-secondary)'
                : 'rgba(255, 255, 255, 0.08)',
              color: showMinorControls ? '#000000' : 'var(--text-primary)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
            onClick={() => setShowMinorControls((v) => !v)}
          >
            <TrafficCone size={12} aria-label="Traffic Signal Icon" />
            <span>{showMinorControls ? 'Hide Minor Controls' : 'Show Minor Controls'}</span>
          </button>

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
              marginLeft: '4px',
            }}
            onClick={() => setDockExpanded(false)}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      ) : (
        <button
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setDockExpanded(true)}
          title="Show Map Controls"
        >
          <Sliders size={16} />
        </button>
      )}
    </div>
  );
};
