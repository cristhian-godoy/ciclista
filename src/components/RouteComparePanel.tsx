import React from 'react';

import type { RouteAlternative } from '../core/router/types';

interface RouteComparePanelProps {
  routeAlternatives: RouteAlternative[];
  activeAlternativeLabel: 'standard' | 'avoid-stops' | 'quiet-streets';
  onSelectAlternative: (label: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
}

/**
 *
 */
export const RouteComparePanel: React.FC<RouteComparePanelProps> = ({
  routeAlternatives,
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

  const getStrategyLabel = (label: string) => {
    switch (label) {
      case 'standard':
        return '⚡ Speed';
      case 'avoid-stops':
        return '🛑 Stops';
      case 'quiet-streets':
        return '🌳 Quiet';
      default:
        return label;
    }
  };

  if (routeAlternatives.length === 0) {
    return (
      <section className="ciclista-card" style={{ padding: '16px', textAlign: 'center' }}>
        <h2>Route Comparison</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '12px 0' }}>
          No routes calculated yet. Move pins to generate route comparisons.
        </p>
      </section>
    );
  }

  return (
    <section className="ciclista-card" style={{ padding: '14px 12px' }}>
      <h2 style={{ marginBottom: '12px', fontSize: '0.95rem', fontWeight: '700' }}>
        Route Comparison
      </h2>
      <div style={{ overflowX: 'auto', margin: '0 -4px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.75rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '6px 4px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                Metric
              </th>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <th
                    key={alt.label}
                    onClick={() =>
                      onSelectAlternative(alt.label as 'standard' | 'avoid-stops' | 'quiet-streets')
                    }
                    style={{
                      padding: '8px 4px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: isActive ? '700' : '500',
                      background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      borderTopLeftRadius: '4px',
                      borderTopRightRadius: '4px',
                      borderBottom: isActive ? '2px solid var(--accent-primary)' : 'none',
                      transition: 'var(--transition-fast)',
                    }}
                  >
                    {getStrategyLabel(alt.label)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Time prediction */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Time Predict
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontWeight: isActive ? '700' : 'normal',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    {formatTime(alt.result.totalDurationSeconds)}
                  </td>
                );
              })}
            </tr>

            {/* Distance */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Distance
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    {formatDistance(alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Signals */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Traffic Lights
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    🚦 {alt.result.signalCount}
                  </td>
                );
              })}
            </tr>

            {/* Yields */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Yield Signs
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    ⚠️ {alt.result.yieldCount}
                  </td>
                );
              })}
            </tr>

            {/* Crossing */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Crossings
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    🚶 {alt.result.crossingCount}
                  </td>
                );
              })}
            </tr>

            {/* Road mix: Cycleway */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td
                style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--accent-secondary)' }}
              >
                🚲 % Cycleway
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.roadTypeTotals?.cycleway || 0;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontWeight: isActive ? '700' : 'normal',
                      color: 'var(--accent-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Road mix: Residential */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                🏠 % Resident
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.roadTypeTotals?.residential || 0;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Road mix: Primary */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--accent-danger)' }}>
                🚗 % Primary
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.roadTypeTotals?.primary || 0;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      color: 'var(--accent-danger)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Surface mix: Paved */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                🛣️ % Paved
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.surfaceTotals?.paved || 0;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Surface mix: Gravel */}
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                🪨 % Gravel
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.surfaceTotals?.gravel || 0;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
                    {formatPct(dist, alt.result.totalDistanceMeters)}
                  </td>
                );
              })}
            </tr>

            {/* Surface mix: Cobblestone */}
            <tr style={{ borderBottom: 'none' }}>
              <td style={{ padding: '8px 4px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                🧱 % Cobble
              </td>
              {routeAlternatives.map((alt) => {
                const isActive = activeAlternativeLabel === alt.label;
                const dist = alt.result.surfaceTotals?.cobblestone || 0;
                return (
                  <td
                    key={alt.label}
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    }}
                  >
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
