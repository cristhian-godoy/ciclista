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
          <span className="dock-label">Map Layers</span>

          <div className="map-layer-dock-separator" />

          <button
            className={`dock-btn ${showMinorControls ? 'dock-btn--active' : ''}`}
            onClick={() => setShowMinorControls(!showMinorControls)}
            aria-label={showMinorControls ? 'Hide Minor Controls' : 'Show Minor Controls'}
            title={showMinorControls ? 'Hide Minor Controls' : 'Show Minor Controls'}
          >
            <TrafficCone size={16} />
          </button>

          {hasRoute && !isNavigating && (
            <button
              className={`dock-btn ${isInspectorModeActive ? 'dock-btn--active' : ''}`}
              onClick={onToggleInspectorMode}
              aria-label={isInspectorModeActive ? 'Deactivate Inspector' : 'Activate Inspector'}
              title={isInspectorModeActive ? 'Deactivate Inspector' : 'Activate Inspector'}
            >
              <Search size={16} />
            </button>
          )}

          <button className="dock-close-btn" onClick={() => setDockExpanded(false)}>
            <ChevronDown size={14} />
          </button>
        </div>
      ) : (
        <button
          className="dock-collapsed-btn"
          onClick={() => setDockExpanded(true)}
          title="Show Map Controls"
        >
          <Sliders size={16} />
        </button>
      )}
    </div>
  );
};
