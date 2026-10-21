import React, { useState } from 'react';

import type { RouteResult, StrategyRouteVariant } from '../core/router/types';
import { formatDistance, formatTime, getStrategyLabel } from '../utils/formatters';
import { AccordionSection } from './common/AccordionSection';
import { Badge } from './common/Badge';
import { Bug, Check, Clock, Copy, Ruler, TrafficCone } from './common/Icon';

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

      {/* Debug Route Details */}
      {routeResult && routeResult.edges && (
        <section className="ciclista-card">
          <AccordionSection
            title="Debug Route Edges"
            icon={<Bug size={16} className="stats-debug-icon" />}
            isOpen={showDebug}
            onToggle={setShowDebug}
            headerClassName="stats-debug-header"
            headerActions={
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
            }
          >
            <div className="stats-debug-container">
              {routeResult.edges.map((edge, index) => (
                <div key={index} className="stats-edge-item">
                  <div className="stats-edge-title">
                    <span>
                      {index + 1}. {edge.name}
                    </span>
                    {edge.matchedSign && (
                      <Badge variant="tag" className="stats-tag-badge">
                        {edge.matchedSign}
                      </Badge>
                    )}
                    {!edge.matchedSign && edge.matchedRoad && (
                      <Badge variant="road" className="stats-tag-badge stats-tag-badge--road">
                        {edge.matchedRoad}
                      </Badge>
                    )}
                  </div>
                  <div className="stats-edge-row">
                    <span>
                      Type:{' '}
                      <Badge variant="bike" className="badge-bike">
                        {edge.highway}
                      </Badge>
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
          </AccordionSection>
        </section>
      )}
    </>
  );
};
