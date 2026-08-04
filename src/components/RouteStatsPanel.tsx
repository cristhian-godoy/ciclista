import {
  Bug,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Octagon,
  Ruler,
  TrafficCone,
  Trees,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';

import type { RouteResult, StrategyRouteVariant } from '../core/router/types';

interface RouteStatsPanelProps {
  routeVariants: StrategyRouteVariant[];
  routingStrategy: 'standard' | 'avoid-stops' | 'quiet-streets';
  onStrategyChange: (strategy: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  routeResult: RouteResult | null;
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
  routeResult,
  isNavigating,
}) => {
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyDebug = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!routeResult || !routeResult.edges) return;

    const debugText = JSON.stringify(
      {
        totalDurationSeconds: routeResult.totalDurationSeconds,
        totalDistanceMeters: routeResult.totalDistanceMeters,
        trafficSignalsCount: routeResult.trafficSignalsCount,
        edges: routeResult.edges.map((edge) => ({
          name: edge.name,
          highway: edge.highway,
          distance: edge.distance,
          cost: edge.cost,
          tags: edge.tags,
        })),
      },
      null,
      2,
    );

    navigator.clipboard.writeText(debugText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  return (
    <>
      {/* Route Alternatives Selector */}
      <section className="ciclista-form-group">
        <label className="ciclista-label">Route Alternatives</label>
        <div className="stats-alt-list">
          {routeVariants.map((alt) => {
            const isActive = routingStrategy === alt.label;
            const duration = alt.result.totalDurationSeconds;
            const distance = alt.result.totalDistanceMeters;
            const signals = alt.result.signalCount;

            const getStrategyLabel = (label: string): React.ReactNode => {
              switch (label) {
                case 'standard':
                  return (
                    <span className="strategy-label-badge">
                      <Zap size={14} aria-label="Speed Icon" />
                      Speed
                    </span>
                  );
                case 'avoid-stops':
                  return (
                    <span className="strategy-label-badge">
                      <Octagon size={14} aria-label="Avoid Stops Icon" />
                      Avoid Stops
                    </span>
                  );
                case 'quiet-streets':
                  return (
                    <span className="strategy-label-badge">
                      <Trees size={14} aria-label="Quiet Paths Icon" />
                      Quiet Paths
                    </span>
                  );
                default:
                  return label;
              }
            };

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
                  {isActive && <span className="stats-alt-active-badge">Active</span>}
                </div>
                <div className="stats-alt-metrics">
                  <span className="strategy-label-badge">
                    <Clock size={12} aria-label="Duration Icon" />
                    {formatTime(duration)}
                  </span>
                  <span className="strategy-label-badge">
                    <Ruler size={12} aria-label="Distance Icon" />
                    {formatDistance(distance)}
                  </span>
                  <span className="strategy-label-badge">
                    <TrafficCone size={12} aria-label="Traffic Signals Icon" />
                    {signals} signals
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Debug Route Details */}
      {routeResult && routeResult.edges && (
        <section className="ciclista-card">
          <h2 onClick={() => setShowDebug(!showDebug)} className="stats-debug-header">
            <span className="stats-debug-title">
              <Bug size={16} className="stats-debug-icon" />
              Debug Route Edges
            </span>
            <div className="stats-debug-actions">
              <button
                onClick={handleCopyDebug}
                title="Copy path debug info to clipboard"
                className="stats-copy-btn"
              >
                {copied ? (
                  <>
                    <Check size={10} className="badge-bike" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={10} />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
              {showDebug ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </h2>
          {showDebug && (
            <div className="stats-debug-container">
              {routeResult.edges.map((edge, index) => (
                <div key={index} className="stats-edge-item">
                  <div className="stats-edge-title">
                    <span>
                      {index + 1}. {edge.name}
                    </span>
                    {edge.matchedSign && (
                      <code className="stats-tag-badge">{edge.matchedSign}</code>
                    )}
                    {!edge.matchedSign && edge.matchedRoad && (
                      <code className="stats-tag-badge stats-tag-badge--road">
                        {edge.matchedRoad}
                      </code>
                    )}
                  </div>
                  <div className="stats-edge-row">
                    <span>
                      Type: <code className="badge-bike">{edge.highway}</code>
                    </span>
                    <span>{Math.round(edge.distance)}m</span>
                    <span>Cost: {Math.round(edge.cost)}s</span>
                  </div>
                  {Object.entries(edge.tags).length > 0 && (
                    <div className="stats-tags-box">
                      {Object.entries(edge.tags).map(([key, val]) => (
                        <div key={key} className="stats-tag-kv">
                          <strong className="text-secondary">{key}:</strong> {String(val)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
};
