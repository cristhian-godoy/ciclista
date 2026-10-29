import React, { useRef, useState } from 'react';

import { setDataSaverActive } from '../core/storage/dataUsage';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { settingsStore, useSettings } from '../store/settingsStore';
import { Box, Moon, Palette, Sun, Wifi, WifiOff } from './common/Icon';

/**
 * Properties for the GlobalControlsPanel component.
 */
export interface GlobalControlsPanelProps {
  /**
   * Active map theme.
   */
  theme: 'bright' | 'liberty' | 'dark';
  /**
   * Callback fired when map theme is changed.
   */
  onThemeChange: (theme: 'bright' | 'liberty' | 'dark') => void;
}

/**
 * Global controls overlay panel housing theme toggles and data saver options,
 * styled to group visually with native MapLibre overlays.
 */
export const GlobalControlsPanel: React.FC<GlobalControlsPanelProps> = ({
  theme,
  onThemeChange,
}) => {
  const settings = useSettings();
  const dataSaver = settings.dataSaver;
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggleDataSaver = () => {
    const nextVal = !dataSaver;
    setDataSaverActive(nextVal);
    settingsStore.updateSettings({ dataSaver: nextVal });
  };

  useOnClickOutside(panelRef, () => setIsThemeExpanded(false), isThemeExpanded, 'click');

  return (
    <div ref={panelRef} className="maplibregl-ctrl maplibregl-ctrl-group global-controls-panel">
      <button
        type="button"
        onClick={() => setIsThemeExpanded((prev) => !prev)}
        title={`Select Theme (Current: ${theme})`}
        aria-label={`Select Theme (Current: ${theme})`}
      >
        <span className="maplibregl-ctrl-icon ctrl-icon-center">
          <Palette size={16} />
        </span>
      </button>

      <button
        type="button"
        onClick={handleToggleDataSaver}
        className={dataSaver ? 'ctrl-btn--active' : undefined}
        title={
          dataSaver
            ? 'Data Saver Active (Click to deactivate)'
            : 'Data Saver Inactive (Click to activate)'
        }
        aria-label={
          dataSaver
            ? 'Data Saver Active (Click to deactivate)'
            : 'Data Saver Inactive (Click to activate)'
        }
      >
        <span className="maplibregl-ctrl-icon ctrl-icon-center">
          {dataSaver ? <WifiOff size={16} /> : <Wifi size={16} />}
        </span>
      </button>

      {isThemeExpanded && (
        <div className="maplibregl-ctrl maplibregl-ctrl-group ctrl-group-horizontal global-controls-popover">
          <button
            type="button"
            onClick={() => {
              onThemeChange('bright');
              setIsThemeExpanded(false);
            }}
            className={theme === 'bright' ? 'ctrl-btn--active' : undefined}
            title="Bright Theme"
            aria-label="Bright Theme"
          >
            <span className="maplibregl-ctrl-icon ctrl-icon-center">
              <Sun size={16} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onThemeChange('liberty');
              setIsThemeExpanded(false);
            }}
            className={theme === 'liberty' ? 'ctrl-btn--active' : undefined}
            title="Liberty Theme"
            aria-label="Liberty Theme"
          >
            <span className="maplibregl-ctrl-icon ctrl-icon-center">
              <Box size={16} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onThemeChange('dark');
              setIsThemeExpanded(false);
            }}
            className={theme === 'dark' ? 'ctrl-btn--active' : undefined}
            title="Dark Theme"
            aria-label="Dark Theme"
          >
            <span className="maplibregl-ctrl-icon ctrl-icon-center">
              <Moon size={16} />
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
