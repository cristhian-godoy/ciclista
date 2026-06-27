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
    <div className="global-controls-panel ciclista-glass-panel">
      <button
        onClick={handleThemeCycle}
        title={`Cycle Theme (Current: ${theme})`}
        aria-label={`Cycle Theme (Current: ${theme})`}
        className="global-control-btn"
      >
        {theme === 'bright' && <Sun size={16} />}
        {theme === 'dark' && <Moon size={16} />}
        {theme === 'liberty' && <Monitor size={16} />}
      </button>

      <div className="global-control-separator" />

      <button
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
        className={`global-control-btn ${dataSaver ? 'active' : ''}`}
      >
        {dataSaver ? <WifiOff size={16} /> : <Wifi size={16} />}
      </button>
    </div>
  );
};
