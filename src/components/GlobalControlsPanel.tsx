import { Box, Moon, Palette, Sun, Wifi, WifiOff } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

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
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggleDataSaver = () => {
    const nextVal = !dataSaver;
    setDataSaver(nextVal);
    setDataSaverActive(nextVal);
  };

  useEffect(() => {
    if (!isThemeExpanded) return;
    const handleDocumentClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsThemeExpanded(false);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [isThemeExpanded]);

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
        <div className="maplibregl-ctrl maplibregl-ctrl-group horizontal-ctrl-group global-controls-popover">
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
