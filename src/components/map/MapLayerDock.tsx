import { ChevronDown, Search, Sliders, TrafficCone } from 'lucide-react';
import React from 'react';

import { useMapContext } from './MapContext';

/**
 * Collapsible map overlay panel that controls the visibility of street networks,
 * bounding boxes, node markers, and traffic signal overlays.
 */
export const MapLayerDock: React.FC = () => {
  const {
    showMinorControls,
    setShowMinorControls,
    dockExpanded,
    setDockExpanded,
    isInspectorModeActive,
    onToggleInspectorMode,
    routeVariants,
    isNavigating,
  } = useMapContext();

  const hasRoute = routeVariants && routeVariants.length > 0;

  return (
    <div className="map-layer-dock">
      {dockExpanded ? (
        <div className="map-layer-dock-expanded">
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

          <div className="map-layer-dock-separator" />

          <button
            style={{
              background: showMinorControls
                ? 'var(--accent-secondary)'
                : 'rgba(255, 255, 255, 0.08)',
              color: showMinorControls ? '#000000' : 'var(--text-primary)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onClick={() => setShowMinorControls(!showMinorControls)}
            aria-label={showMinorControls ? 'Hide Minor Controls' : 'Show Minor Controls'}
            title={showMinorControls ? 'Hide Minor Controls' : 'Show Minor Controls'}
          >
            <TrafficCone size={16} />
          </button>

          {hasRoute && !isNavigating && (
            <button
              style={{
                background: isInspectorModeActive
                  ? 'var(--accent-secondary)'
                  : 'rgba(255, 255, 255, 0.08)',
                color: isInspectorModeActive ? '#000000' : 'var(--text-primary)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onClick={onToggleInspectorMode}
              aria-label={isInspectorModeActive ? 'Deactivate Inspector' : 'Activate Inspector'}
              title={isInspectorModeActive ? 'Deactivate Inspector' : 'Activate Inspector'}
            >
              <Search size={16} />
            </button>
          )}

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
