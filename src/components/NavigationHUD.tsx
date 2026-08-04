import React from 'react';

import { useMapContext } from './map/MapContext';

/**
 * Floating head-up display showing navigation telemetry (speed, remaining distance, ETA).
 */
export const NavigationHUD: React.FC = () => {
  const { isNavigating, navigationState } = useMapContext();

  if (!isNavigating || !navigationState.progress) return null;

  const { currentSpeedKmh, distanceRemainingM, etaSeconds } = navigationState.progress;
  const showWASD = import.meta.env.DEV;

  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="navigation-hud ciclista-glass-panel">
      <div className="hud-item">
        <span className="hud-label">Speed</span>
        <span className="hud-value">
          {Math.round(currentSpeedKmh)}
          <span className="hud-unit">km/h</span>
          {showWASD && (
            <span className="hud-wasd-badge" title="Keyboard WASD controls active">
              WASD
            </span>
          )}
        </span>
      </div>

      <div className="hud-divider" />

      <div className="hud-item">
        <span className="hud-label">Remaining</span>
        <span className="hud-value">{formatDistance(distanceRemainingM)}</span>
      </div>

      <div className="hud-divider" />

      <div className="hud-item">
        <span className="hud-label">ETA</span>
        <span className="hud-value hud-value--eta">{formatDuration(etaSeconds)}</span>
      </div>
    </div>
  );
};
