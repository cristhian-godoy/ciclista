import React from 'react';

import type { RouteResult, StrategyRouteVariant } from '../core/router/types';
import { formatDistance, formatTime, getStrategyLabel } from '../utils/formatters';
import { Badge } from './common/Badge';
import { Clock, Ruler, TrafficCone } from './common/Icon';

interface RouteStatsPanelProps {
  routeVariants: StrategyRouteVariant[];
  routingStrategy: 'standard' | 'avoid-stops' | 'quiet-streets';
  onStrategyChange: (strategy: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  routeResult?: RouteResult | null;
  isNavigating: boolean;
}

/**
 * Sidebar panel displaying route statistics (distance, time, delays) and
 * allowing users to switch between routing strategies (standard, avoid-stops, quiet-streets).
 */
export const RouteStatsPanel: React.FC<RouteStatsPanelProps> = ({
  routeVariants,
  routingStrategy,
  onStrategyChange,
  isNavigating,
}) => {
  return (
    <section className="ciclista-form-group">
      <label className="ciclista-label">Route Alternatives</label>
      <div className="stats-alt-list">
        {routeVariants.map((alt) => {
          const isActive = routingStrategy === alt.label;
          const duration = alt.result.totalDurationSeconds;
          const distance = alt.result.totalDistanceMeters;
          const signals = alt.result.signalCount;

          return (
            <div
              key={alt.label}
              className={`alternative-card stats-alt-card ${isActive ? 'active' : ''} ${
                isNavigating && !isActive ? 'disabled' : ''
              }`}
              onClick={() => {
                if (isNavigating) return;
                onStrategyChange(alt.label as 'standard' | 'avoid-stops' | 'quiet-streets');
              }}
            >
              <div className="stats-alt-header">
                <span className="stats-alt-title">{getStrategyLabel(alt.label)}</span>
                {isActive && (
                  <Badge variant="active" className="stats-alt-active-badge">
                    Active
                  </Badge>
                )}
              </div>
              <div className="stats-alt-metrics">
                <Badge
                  variant="strategy"
                  className="strategy-label-badge"
                  icon={<Clock size={12} aria-label="Duration Icon" />}
                >
                  {formatTime(duration)}
                </Badge>
                <Badge
                  variant="strategy"
                  className="strategy-label-badge"
                  icon={<Ruler size={12} aria-label="Distance Icon" />}
                >
                  {formatDistance(distance)}
                </Badge>
                <Badge
                  variant="strategy"
                  className="strategy-label-badge"
                  icon={<TrafficCone size={12} aria-label="Traffic Signals Icon" />}
                >
                  {signals} signals
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
