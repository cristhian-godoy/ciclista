import React, { useState } from 'react';
import type {
  Coordinate,
  RouteResult,
  RulesConfiguration,
  BikeProfile,
  RouteAlternative,
} from '../core/types';
import {
  Navigation,
  RefreshCw,
  Layers,
  Bug,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { RulesConfigPanel } from './RulesConfigPanel';
import { RouteComparePanel } from './RouteComparePanel';

interface SidebarProps {
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeResult: RouteResult | null;
  routeAlternatives: RouteAlternative[];
  routingStrategy: 'standard' | 'avoid-stops' | 'quiet-streets';
  isFetchingOSM: boolean;
  onStrategyChange: (strategy: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  onPresetChange: (presetName: 'munich' | 'amsterdam') => void;
  rulesConfig: RulesConfiguration;
  onRulesChange: (config: RulesConfiguration) => void;
  bikeProfile: BikeProfile;
  onBikeProfileChange: (profile: BikeProfile) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  routeResult,
  routeAlternatives,
  routingStrategy,
  isFetchingOSM,
  onStrategyChange,
  selectedPreset,
  onPresetChange,
  rulesConfig,
  onRulesChange,
  bikeProfile,
  onBikeProfileChange,
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
  // Formatting helpers
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
    <aside className="sidebar">
      <div className="sidebar-header">
        <Navigation
          size={24}
          className="color-primary"
          style={{ color: 'var(--accent-primary)' }}
        />
        <h1>Ciclista</h1>
      </div>

      <div className="sidebar-content">
        {/* Section 1: Dynamic Presets & Auto-Fetch Info */}
        <section className="route-card">
          <h2>
            <Layers
              size={16}
              style={{
                verticalAlign: 'middle',
                marginRight: '8px',
                color: 'var(--accent-secondary)',
              }}
            />
            Map Area Presets
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Choose a preset city. The map area will automatically expand and fetch OSM data as you
            drag or position the pins.
          </p>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">City Preset</label>
            <select
              className="input-text"
              value={selectedPreset}
              onChange={(e) => onPresetChange(e.target.value as 'munich' | 'amsterdam')}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="munich">Munich (Marienplatz)</option>
              <option value="amsterdam">Amsterdam (Center)</option>
            </select>
          </div>
          {isFetchingOSM && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.75rem',
                color: 'var(--accent-secondary)',
                marginTop: '8px',
              }}
            >
              <RefreshCw size={12} className="spin" />
              <span>Fetching street network from Overpass...</span>
            </div>
          )}
        </section>

        {/* Section 2: Route Alternatives Selector */}
        <section className="form-group">
          <label className="form-label">Route Alternatives</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {routeAlternatives.map((alt) => {
              const isActive = routingStrategy === alt.label;
              const duration = alt.result.totalDurationSeconds;
              const distance = alt.result.totalDistanceMeters;
              const signals = alt.result.signalCount;

              const getStrategyLabel = (label: string) => {
                switch (label) {
                  case 'standard':
                    return '⚡ Speed';
                  case 'avoid-stops':
                    return '🛑 Avoid Stops';
                  case 'quiet-streets':
                    return '🌳 Quiet Paths';
                  default:
                    return label;
                }
              };

              return (
                <div
                  key={alt.label}
                  className={`alternative-card ${isActive ? 'active' : ''}`}
                  onClick={() =>
                    onStrategyChange(alt.label as 'standard' | 'avoid-stops' | 'quiet-streets')
                  }
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary)',
                    border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)',
                    boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                    }
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {getStrategyLabel(alt.label)}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          background: 'var(--accent-primary)',
                          color: 'var(--text-primary)',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontWeight: '600',
                        }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>⏱️ {formatTime(duration)}</span>
                    <span>📏 {formatDistance(distance)}</span>
                    <span>🚦 {signals} signals</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 2b: Bike Profile */}
        <section className="form-group">
          <label className="form-label">Bike Profile</label>
          <div className="strategy-selector">
            {(['slow', 'normal', 'ebike'] as BikeProfile[]).map((p) => (
              <button
                key={p}
                className={`strategy-btn ${bikeProfile === p ? 'active' : ''}`}
                onClick={() => onBikeProfileChange(p)}
              >
                {p === 'slow' ? '🚲 Slow' : p === 'normal' ? '🚴 Normal' : '⚡ E-Bike'}
              </button>
            ))}
          </div>
        </section>

        {/* Section 3: Road Rules Configuration */}
        <RulesConfigPanel config={rulesConfig} onChange={onRulesChange} />

        {/* Section 4: Route Comparison Panel */}
        <RouteComparePanel
          routeAlternatives={routeAlternatives}
          activeAlternativeLabel={routingStrategy}
          onSelectAlternative={onStrategyChange}
        />

        {/* Section 4: Debug Route Details */}
        {routeResult && routeResult.edges && (
          <section className="route-card">
            <h2
              onClick={() => setShowDebug(!showDebug)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                margin: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <Bug size={16} style={{ marginRight: '8px', color: 'var(--accent-primary)' }} />
                Debug Route Edges
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleCopyDebug}
                  title="Copy path debug info to clipboard"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    zIndex: 2,
                  }}
                >
                  {copied ? (
                    <>
                      <Check size={10} style={{ color: 'var(--accent-secondary)' }} />
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
              <div
                style={{
                  marginTop: '12px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {routeResult.edges.map((edge, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.75rem',
                      lineHeight: '1.4',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 'bold',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>
                        {index + 1}. {edge.name}
                      </span>
                      {edge.matchedSign && (
                        <code
                          style={{
                            fontSize: '0.62rem',
                            background: 'rgba(139,92,246,0.15)',
                            color: 'hsl(265,80%,72%)',
                            border: '1px solid rgba(139,92,246,0.3)',
                            borderRadius: '3px',
                            padding: '1px 5px',
                          }}
                        >
                          {edge.matchedSign}
                        </code>
                      )}
                      {!edge.matchedSign && edge.matchedRoad && (
                        <code
                          style={{
                            fontSize: '0.62rem',
                            background: 'rgba(14,165,233,0.12)',
                            color: 'hsl(200,80%,65%)',
                            border: '1px solid rgba(14,165,233,0.25)',
                            borderRadius: '3px',
                            padding: '1px 5px',
                          }}
                        >
                          {edge.matchedRoad}
                        </code>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                      }}
                    >
                      <span>
                        Type:{' '}
                        <code style={{ color: 'var(--accent-secondary)' }}>{edge.highway}</code>
                      </span>
                      <span>{Math.round(edge.distance)}m</span>
                      <span>Cost: {Math.round(edge.cost)}s</span>
                    </div>
                    {Object.entries(edge.tags).length > 0 && (
                      <div
                        style={{
                          marginTop: '4px',
                          padding: '4px 6px',
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: '4px',
                        }}
                      >
                        {Object.entries(edge.tags).map(([key, val]) => (
                          <div
                            key={key}
                            style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}
                          >
                            <strong style={{ color: 'var(--text-secondary)' }}>{key}:</strong>{' '}
                            {String(val)}
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
      </div>

      <div className="sidebar-footer">
        <p>Drag green/red pins or right-click map to route.</p>
        <p style={{ marginTop: '4px' }}>Click red nodes to time stoplights.</p>
      </div>
    </aside>
  );
};
