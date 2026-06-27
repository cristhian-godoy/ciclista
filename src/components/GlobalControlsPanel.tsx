import { Monitor, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import React, { useState } from 'react';

import { isDataSaverActive, setDataSaverActive } from '../core/storage/dataUsage';

interface GlobalControlsPanelProps {
  theme: 'bright' | 'liberty' | 'dark';
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
  const [dataSaver, setDataSaver] = useState(isDataSaverActive());

  const handleToggleDataSaver = () => {
    const nextVal = !dataSaver;
    setDataSaver(nextVal);
    setDataSaverActive(nextVal);
  };

  const handleThemeCycle = () => {
    if (theme === 'bright') {
      onThemeChange('dark');
    } else if (theme === 'dark') {
      onThemeChange('liberty');
    } else {
      onThemeChange('bright');
    }
  };

  return (
    <div
      className="maplibregl-ctrl maplibregl-ctrl-group"
      style={{ position: 'absolute', top: '120px', right: '10px', zIndex: 10 }}
    >
      <button
        type="button"
        onClick={handleThemeCycle}
        title={`Cycle Theme (Current: ${theme})`}
        aria-label={`Cycle Theme (Current: ${theme})`}
      >
        <span
          className="maplibregl-ctrl-icon"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {theme === 'bright' && <Sun size={16} />}
          {theme === 'dark' && <Moon size={16} />}
          {theme === 'liberty' && <Monitor size={16} />}
        </span>
      </button>

      <button
        type="button"
        onClick={handleToggleDataSaver}
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
        style={
          dataSaver
            ? {
                backgroundColor: 'var(--ciclista-color-brand-secondary-hover)',
                color: 'var(--ciclista-color-surface-base)',
              }
            : undefined
        }
      >
        <span
          className="maplibregl-ctrl-icon"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {dataSaver ? <WifiOff size={16} /> : <Wifi size={16} />}
        </span>
      </button>
    </div>
  );
};
