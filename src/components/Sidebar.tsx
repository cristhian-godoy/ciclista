import React, { useState } from 'react';
import type { Coordinate, RouteResult, RulesConfiguration } from '../core/types';
import { Navigation, RefreshCw, Layers, Bug, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { RulesConfigPanel } from './RulesConfigPanel';

interface SidebarProps {
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeResult: RouteResult | null;
  routingStrategy: 'standard' | 'avoid-stops' | 'quiet-streets';
  isFetchingOSM: boolean;
  onStrategyChange: (strategy: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  selectedPreset: 'munich' | 'amsterdam';
  onPresetChange: (presetName: 'munich' | 'amsterdam') => void;
  rulesConfig: RulesConfiguration;
  onRulesChange: (config: RulesConfiguration) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  routeResult,
  routingStrategy,
  isFetchingOSM,
  onStrategyChange,
  selectedPreset,
  onPresetChange,
  rulesConfig,
  onRulesChange,
}) => {
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyDebug = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!routeResult || !routeResult.edges) return;
    
    const debugText = JSON.stringify({
      totalDurationSeconds: routeResult.totalDurationSeconds,
      totalDistanceMeters: routeResult.totalDistanceMeters,
      trafficSignalsCount: routeResult.trafficSignalsCount,
      edges: routeResult.edges.map(edge => ({
        name: edge.name,
        highway: edge.highway,
        distance: edge.distance,
        cost: edge.cost,
        tags: edge.tags
      }))
    }, null, 2);

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
        <Navigation size={24} className="color-primary" style={{ color: 'var(--accent-primary)' }} />
        <h1>Ciclista</h1>
      </div>

      <div className="sidebar-content">
        {/* Section 1: Dynamic Presets & Auto-Fetch Info */}
        <section className="route-card">
          <h2>
            <Layers size={16} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--accent-secondary)' }} />
            Map Area Presets
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Choose a preset city. The map area will automatically expand and fetch OSM data as you drag or position the pins.
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--accent-secondary)', marginTop: '8px' }}>
              <RefreshCw size={12} className="spin" />
              <span>Fetching street network from Overpass...</span>
            </div>
          )}
        </section>

        {/* Section 2: Strategy Selector */}
        <section className="form-group">
          <label className="form-label">Routing Cost Strategy</label>
          <div className="strategy-selector">
            <button
              className={`strategy-btn ${routingStrategy === 'standard' ? 'active' : ''}`}
              onClick={() => onStrategyChange('standard')}
            >
              Speed
            </button>
            <button
              className={`strategy-btn ${routingStrategy === 'avoid-stops' ? 'active' : ''}`}
              onClick={() => onStrategyChange('avoid-stops')}
            >
              Avoid Stops
            </button>
            <button
              className={`strategy-btn ${routingStrategy === 'quiet-streets' ? 'active' : ''}`}
              onClick={() => onStrategyChange('quiet-streets')}
            >
              Quiet Paths
            </button>
          </div>
        </section>

        {/* Section 3: Road Rules Configuration */}
        <RulesConfigPanel config={rulesConfig} onChange={onRulesChange} />

        {/* Section 4: Travel Analytics */}
        <section className="route-card">
          <h2>Route Analytics</h2>
          {routeResult ? (
            <div>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-val">{formatTime(routeResult.totalDurationSeconds)}</span>
                  <span className="stat-lbl">Time Cost</span>
                </div>
                <div className="stat-item">
                  <span className="stat-val">{formatDistance(routeResult.totalDistanceMeters)}</span>
                  <span className="stat-lbl">Distance</span>
                </div>
                <div className="stat-item">
                  <span className="stat-val">{routeResult.trafficSignalsCount}</span>
                  <span className="stat-lbl">Signals</span>
                </div>
              </div>

              {routeResult.streets.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <span className="form-label" style={{ display: 'block', marginBottom: '4px' }}>Streets Traversed</span>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {routeResult.streets.join(' → ')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              No route found. Drag map pins to trigger routing calculations.
            </p>
          )}
        </section>

        {/* Section 4: Debug Route Details */}
        {routeResult && routeResult.edges && (
          <section className="route-card">
            <h2 
              onClick={() => setShowDebug(!showDebug)} 
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}
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
              <div style={{ marginTop: '12px', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {routeResult.edges.map((edge, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      padding: '8px', 
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.75rem',
                      lineHeight: '1.4'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {index + 1}. {edge.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <span>Type: <code style={{ color: 'var(--accent-secondary)' }}>{edge.highway}</code></span>
                      <span>{Math.round(edge.distance)}m</span>
                      <span>Cost: {Math.round(edge.cost)}s</span>
                    </div>
                    {Object.entries(edge.tags).length > 0 && (
                      <div style={{ marginTop: '4px', padding: '4px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                        {Object.entries(edge.tags).map(([key, val]) => (
                          <div key={key} style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>{key}:</strong> {String(val)}
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
