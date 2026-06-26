import {
  Accessibility,
  AlertTriangle,
  Bike,
  Car,
  Clock,
  Home,
  Layers,
  Milestone,
  Octagon,
  Route,
  TrafficCone,
  Trees,
  Zap,
} from 'lucide-react';
import React from 'react';

import type { StrategyRouteVariant } from '../core/router/types';

interface RouteComparePanelProps {
  routeVariants: StrategyRouteVariant[];
  activeAlternativeLabel: 'standard' | 'avoid-stops' | 'quiet-streets';
  onSelectAlternative: (label: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
}

/**
 * Renders a side-by-side comparison of generated routes with Lucide icons.
 */
export const RouteComparePanel: React.FC<RouteComparePanelProps> = ({
  routeVariants,
  activeAlternativeLabel,
  onSelectAlternative,
}) => {
  // Helpers
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatPct = (value: number, total: number) => {
    if (total <= 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  const getStrategyLabel = (label: string): React.ReactNode => {
    switch (label) {
      case 'standard':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              justifyContent: 'center',
            }}
          >
            <Zap size={12} aria-label="Speed Icon" /> Speed
          </span>
        );
      case 'avoid-stops':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              justifyContent: 'center',
            }}
          >
            <Octagon size={12} aria-label="Stops Icon" /> Stops
          </span>
        );
      case 'quiet-streets':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              justifyContent: 'center',
            }}
          >
            <Trees size={12} aria-label="Quiet Icon" /> Quiet
          </span>
        );
      default:
        return label;
    }
  };

  if (routeVariants.length === 0) {
    return (
      <section className="ciclista-card compare-panel-placeholder">
        <h2 className="compare-panel-title">Route Comparison</h2>
        <p className="placeholder-text">
          No routes calculated yet. Move pins to generate route comparisons.
        </p>
      </section>
    );
  }

  return (
    <section className="ciclista-card compare-panel-container">
      <h2 className="compare-panel-title">Route Comparison</h2>
      <div className="compare-table-wrapper">
        <table className="compare-table">
          <thead>
            <tr className="header-row">
              <th className="metric-col">Metric</th>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <th
                    key={alt.label}
                    onClick={() =>
                      onSelectAlternative(alt.label as 'standard' | 'avoid-stops' | 'quiet-streets')
                    }
                    className={`strategy-col ${isActive ? 'active' : ''}`}
                  >
                    {getStrategyLabel(alt.label)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Time prediction */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <Clock size={12} aria-label="Time Icon" /> Time Predict
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td key={alt.label} className={`value-col ${isActive ? 'active' : ''}`}>
                    {formatTime(alt.result.totalDurationSeconds)}
                  </td>
                );
              })}
            </tr>

            {/* Distance */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <Milestone size={12} aria-label="Distance Icon" /> Distance
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td key={alt.label} className={`value-col ${isActive ? 'active' : ''}`}>
                    {formatDistance(alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Signals */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <TrafficCone size={12} aria-label="Signals Icon" /> Traffic Lights
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td key={alt.label} className={`value-col ${isActive ? 'active' : ''}`}>
                    {alt.result.signalCount}
                  </td>
                );
              })}
            </tr>

            {/* Yields */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <AlertTriangle size={12} aria-label="Yield Icon" /> Yield Signs
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td key={alt.label} className={`value-col ${isActive ? 'active' : ''}`}>
                    {alt.result.yieldCount}
                  </td>
                );
              })}
            </tr>

            {/* Crossing */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <Accessibility size={12} aria-label="Crossing Icon" /> Crossings
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td key={alt.label} className={`value-col ${isActive ? 'active' : ''}`}>
                    {alt.result.crossingCount}
                  </td>
                );
              })}
            </tr>

            {/* Road mix: Cycleway */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <Bike size={12} aria-label="Cycleway Icon" /> % Cycleway
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.roadTypeTotals?.cycleway || 0;
                return (
                  <td
                    key={alt.label}
                    className={`value-col cycleway-pct ${isActive ? 'active' : ''}`}
                  >
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Road mix: Residential */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <Home size={12} aria-label="Residential Icon" /> % Resident
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.roadTypeTotals?.residential || 0;
                return (
                  <td key={alt.label} className={`value-col ${isActive ? 'active' : ''}`}>
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Road mix: Primary */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <Car size={12} aria-label="Primary Road Icon" /> % Primary
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.roadTypeTotals?.primary || 0;
                return (
                  <td
                    key={alt.label}
                    className={`value-col primary-pct ${isActive ? 'active' : ''}`}
                  >
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Surface mix: Paved */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <Route size={12} aria-label="Paved Surface Icon" /> % Paved
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.surfaceTotals?.paved || 0;
                return (
                  <td key={alt.label} className={`value-col ${isActive ? 'active' : ''}`}>
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Surface mix: Gravel */}
            <tr>
              <td className="metric-col">
                <span className="metric-cell-content">
                  <Trees size={12} aria-label="Gravel Surface Icon" /> % Gravel
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.surfaceTotals?.gravel || 0;
                return (
                  <td key={alt.label} className={`value-col ${isActive ? 'active' : ''}`}>
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Surface mix: Cobblestone */}
            <tr className="last-row">
              <td className="metric-col">
                <span className="metric-cell-content">
                  <Layers size={12} aria-label="Cobblestone Surface Icon" /> % Cobble
                </span>
              </td>
              {routeVariants.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.surfaceTotals?.cobblestone || 0;
                return (
                  <td key={alt.label} className={`value-col ${isActive ? 'active' : ''}`}>
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};
