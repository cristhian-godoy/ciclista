import React from 'react';

import { formatDistance, formatDuration } from '../utils/formatters';
import { Badge } from './common/Badge';
import { useMapContext } from './map/MapContext';

/**
 * Floating head-up display showing navigation telemetry (speed, remaining distance, ETA).
 */
export const NavigationHUD: React.FC = () => {
  const { isNavigating, navigationState } = useMapContext();

  if (!isNavigating || !navigationState.progress) return null;

  const { currentSpeedKmh, distanceRemainingM, etaSeconds } = navigationState.progress;
  const showWASD = import.meta.env.DEV;

  return (
    <div className="navigation-hud ciclista-glass-panel">
      <div className="hud-item">
        <span className="hud-label">Speed</span>
        <span className="hud-value">
          {Math.round(currentSpeedKmh)}
          <span className="hud-unit">km/h</span>
          {showWASD && (
            <Badge
              variant="keyboard"
              className="hud-wasd-badge"
              title="Keyboard WASD controls active"
            >
              WASD
            </Badge>
          )}
        </span>
      </div>

      <div className="hud-divider" />

      <div className="hud-item">
        <span className="hud-label">Remaining</span>
        <span className="hud-value">{formatDistance(distanceRemainingM, 1)}</span>
      </div>

      <div className="hud-divider" />

      <div className="hud-item">
        <span className="hud-label">ETA</span>
        <span className="hud-value hud-value--eta">{formatDuration(etaSeconds)}</span>
      </div>
    </div>
  );
};
