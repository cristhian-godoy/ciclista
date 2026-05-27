import { Award } from 'lucide-react';
import React from 'react';

import { useMapContext } from './map/MapContext';

/**
 * Overlay modal displaying ride statistics summary upon arriving at destination.
 */
export const ArrivalPanel: React.FC = () => {
  const { navigationState, rideStats, onStopNavigation } = useMapContext();

  if (navigationState.status !== 'arrived' || !rideStats) return null;

  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
    return `${Math.round(m)} m`;
  };

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.round(sec % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="ciclista-glass-panel"
        style={{
          width: '90%',
          maxWidth: '450px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          boxShadow: 'var(--ciclista-shadow-lg)',
          borderRadius: '20px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid var(--ciclista-color-success, #10b981)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ciclista-color-success, #10b981)',
          }}
        >
          <Award size={28} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Destination Reached!</h2>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--ciclista-color-text-secondary)',
              marginTop: '4px',
            }}
          >
            Here is your ride summary
          </p>
        </div>

        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <div className="ciclista-card" style={{ padding: '12px', gap: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                color: 'var(--ciclista-color-text-muted)',
              }}
            >
              Distance
            </span>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {formatDistance(rideStats.totalDistanceM)}
            </span>
          </div>

          <div className="ciclista-card" style={{ padding: '12px', gap: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                color: 'var(--ciclista-color-text-muted)',
              }}
            >
              Ride Time
            </span>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {formatDuration(rideStats.totalTimeSeconds)}
            </span>
          </div>

          <div className="ciclista-card" style={{ padding: '12px', gap: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                color: 'var(--ciclista-color-text-muted)',
              }}
            >
              Avg Speed
            </span>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {rideStats.averageSpeedKmh.toFixed(1)} km/h
            </span>
          </div>

          <div className="ciclista-card" style={{ padding: '12px', gap: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                color: 'var(--ciclista-color-text-muted)',
              }}
            >
              Max Speed
            </span>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {rideStats.maxSpeedKmh.toFixed(1)} km/h
            </span>
          </div>

          <div className="ciclista-card" style={{ padding: '12px', gap: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                color: 'var(--ciclista-color-text-muted)',
              }}
            >
              Stoplights
            </span>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {rideStats.trafficLightsEncountered}
            </span>
          </div>

          <div className="ciclista-card" style={{ padding: '12px', gap: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                color: 'var(--ciclista-color-text-muted)',
              }}
            >
              Profile
            </span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'capitalize' }}>
              {rideStats.routeProfile}
            </span>
          </div>
        </div>

        <button
          className="ciclista-btn ciclista-btn--primary"
          onClick={onStopNavigation}
          style={{ width: '100%', marginTop: '8px' }}
        >
          Close Summary
        </button>
      </div>
    </div>
  );
};
