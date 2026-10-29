import React, { useEffect } from 'react';

import { Badge } from '../common/Badge';
import { CloseButton } from '../common/CloseButton';
import { MousePointer, Paintbrush } from '../common/Icon';
import { SliderField } from '../common/SliderField';
import { useMapContext } from './MapContext';

/**
 * Floating controls dock mounted on the map when in Studio mode.
 * Provides toggling between Click Selection and Radius Brush Selection,
 * controls for the brush radius and quick presets, displays active selection counts,
 * and allows clearing current selections.
 *
 * @returns React element or null when outside Studio mode.
 */
export const SelectionToolsDock: React.FC = () => {
  const {
    appMode,
    selectionTool,
    setSelectionTool,
    brushRadius,
    setBrushRadius,
    selectedEdgeIds,
    onClearSelection,
  } = useMapContext();

  const isEventsMode = appMode === 'events' || (appMode as string) === 'studio';

  // Universal Escape key cancellation contract: reset brush or clear selected edges
  useEffect(() => {
    if (!isEventsMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectionTool === 'brush') {
          setSelectionTool('click');
        } else if (selectedEdgeIds.length > 0) {
          onClearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEventsMode, selectionTool, setSelectionTool, selectedEdgeIds.length, onClearSelection]);

  if (!isEventsMode) {
    return null;
  }

  return (
    <div
      className="map-selection-dock ciclista-card"
      role="toolbar"
      aria-label="Map Selection Tools"
    >
      <div className="map-selection-dock-header">
        <span className="map-selection-dock-title">Selection Tools</span>
        <Badge variant="selected" aria-label={`${selectedEdgeIds.length} edges selected`}>
          {selectedEdgeIds.length} selected
        </Badge>
        {selectedEdgeIds.length > 0 && (
          <CloseButton size="sm" onClick={onClearSelection} label="Clear Selection" />
        )}
      </div>

      <div className="map-selection-dock-tools">
        <button
          type="button"
          className={`ciclista-btn map-selection-dock-tool-btn ${selectionTool === 'click' ? 'active' : ''}`}
          onClick={() => setSelectionTool('click')}
          aria-label="Click Selection"
          title="Click Selection"
          aria-pressed={selectionTool === 'click'}
        >
          <MousePointer size={16} />
          <span>Click</span>
        </button>

        <button
          type="button"
          className={`ciclista-btn map-selection-dock-tool-btn ${selectionTool === 'brush' ? 'active' : ''}`}
          onClick={() => setSelectionTool('brush')}
          aria-label="Radius Brush Selection"
          title="Radius Brush Selection"
          aria-pressed={selectionTool === 'brush'}
        >
          <Paintbrush size={16} />
          <span>Radius Brush</span>
        </button>
      </div>

      {selectionTool === 'brush' && (
        <div className="map-selection-dock-brush-controls" data-testid="brush-controls">
          <SliderField
            label="Radius"
            value={brushRadius}
            min={10}
            max={200}
            step={5}
            unit="m"
            onChange={setBrushRadius}
            ariaLabel="Brush Radius Slider"
            formatValueText={(lbl, val, u) => `${lbl}: ${val}${u}`}
          />

          <div className="map-selection-dock-quick-buttons">
            <button
              type="button"
              className={`ciclista-btn ciclista-btn--sm map-selection-dock-quick-btn ${brushRadius === 25 ? 'active' : ''}`}
              onClick={() => setBrushRadius(25)}
              aria-label="Quick radius 25m"
            >
              25m
            </button>
            <button
              type="button"
              className={`ciclista-btn ciclista-btn--sm map-selection-dock-quick-btn ${brushRadius === 50 ? 'active' : ''}`}
              onClick={() => setBrushRadius(50)}
              aria-label="Quick radius 50m"
            >
              50m
            </button>
            <button
              type="button"
              className={`ciclista-btn ciclista-btn--sm map-selection-dock-quick-btn ${brushRadius === 100 ? 'active' : ''}`}
              onClick={() => setBrushRadius(100)}
              aria-label="Quick radius 100m"
            >
              100m
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
