import { Map, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
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
    <div
      ref={panelRef}
      className="maplibregl-ctrl maplibregl-ctrl-group"
      style={{ position: 'absolute', top: '120px', right: '10px', zIndex: 10 }}
    >
      <button
        type="button"
        onClick={() => setIsThemeExpanded((prev) => !prev)}
        title={`Select Theme (Current: ${theme})`}
        aria-label={`Select Theme (Current: ${theme})`}
      >
        <span
          className="maplibregl-ctrl-icon"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {theme === 'bright' && <Sun size={16} />}
          {theme === 'dark' && <Moon size={16} />}
          {theme === 'liberty' && <Map size={16} />}
        </span>
      </button>

      {isThemeExpanded && (
        <div
          className="maplibregl-ctrl maplibregl-ctrl-group"
          style={{
            position: 'absolute',
            right: '100%',
            top: 0,
            marginRight: '8px',
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onThemeChange('bright');
              setIsThemeExpanded(false);
            }}
            title="Bright Theme"
            aria-label="Bright Theme"
            style={
              theme === 'bright'
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
              <Sun size={16} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onThemeChange('liberty');
              setIsThemeExpanded(false);
            }}
            title="Liberty Theme"
            aria-label="Liberty Theme"
            style={
              theme === 'liberty'
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
              <Map size={16} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onThemeChange('dark');
              setIsThemeExpanded(false);
            }}
            title="Dark Theme"
            aria-label="Dark Theme"
            style={
              theme === 'dark'
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
              <Moon size={16} />
            </span>
          </button>
        </div>
      )}

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
