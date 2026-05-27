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
    <div
      className="navigation-hud ciclista-glass-panel"
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        borderRadius: '16px',
        border: '1px solid var(--ciclista-glass-border-focus)',
        boxShadow: 'var(--ciclista-shadow-lg)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--ciclista-color-text-secondary)',
          }}
        >
          Speed
        </span>
        <span
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'baseline',
            gap: '2px',
          }}
        >
          {Math.round(currentSpeedKmh)}
          <span
            style={{
              fontSize: '12px',
              fontWeight: 'normal',
              color: 'var(--ciclista-color-text-muted)',
            }}
          >
            km/h
          </span>
          {showWASD && (
            <span
              style={{
                marginLeft: '6px',
                fontSize: '9px',
                padding: '1px 4px',
                borderRadius: '4px',
                background: 'rgba(99, 102, 241, 0.2)',
                color: 'var(--ciclista-color-brand-main)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                fontWeight: 'bold',
              }}
              title="Keyboard WASD controls active"
            >
              WASD
            </span>
          )}
        </span>
      </div>

      <div
        style={{
          width: '1px',
          height: '32px',
          background: 'var(--ciclista-glass-border-base)',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--ciclista-color-text-secondary)',
          }}
        >
          Remaining
        </span>
        <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
          {formatDistance(distanceRemainingM)}
        </span>
      </div>

      <div
        style={{
          width: '1px',
          height: '32px',
          background: 'var(--ciclista-glass-border-base)',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--ciclista-color-text-secondary)',
          }}
        >
          ETA
        </span>
        <span
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: 'var(--ciclista-color-brand-main)',
          }}
        >
          {formatDuration(etaSeconds)}
        </span>
      </div>
    </div>
  );
};
