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
    <div className="arrival-overlay">
      <div className="ciclista-glass-panel arrival-content">
        <div className="arrival-icon-wrapper">
          <Award size={28} />
        </div>

        <div className="arrival-header">
          <h2 className="arrival-title">Destination Reached!</h2>
          <p className="arrival-subtitle">Here is your ride summary</p>
        </div>

        <div className="arrival-grid">
          <div className="ciclista-card arrival-card">
            <span className="arrival-label">Distance</span>
            <span className="arrival-val">{formatDistance(rideStats.totalDistanceM)}</span>
          </div>

          <div className="ciclista-card arrival-card">
            <span className="arrival-label">Ride Time</span>
            <span className="arrival-val">{formatDuration(rideStats.totalTimeSeconds)}</span>
          </div>

          <div className="ciclista-card arrival-card">
            <span className="arrival-label">Avg Speed</span>
            <span className="arrival-val">{rideStats.averageSpeedKmh.toFixed(1)} km/h</span>
          </div>

          <div className="ciclista-card arrival-card">
            <span className="arrival-label">Max Speed</span>
            <span className="arrival-val">{rideStats.maxSpeedKmh.toFixed(1)} km/h</span>
          </div>

          <div className="ciclista-card arrival-card">
            <span className="arrival-label">Stoplights</span>
            <span className="arrival-val">{rideStats.trafficLightsEncountered}</span>
          </div>

          <div className="ciclista-card arrival-card">
            <span className="arrival-label">Profile</span>
            <span className="arrival-val arrival-val--cap">{rideStats.routeProfile}</span>
          </div>
        </div>

        <button className="ciclista-btn ciclista-btn--primary" onClick={onStopNavigation}>
          Close Summary
        </button>
      </div>
    </div>
  );
};
