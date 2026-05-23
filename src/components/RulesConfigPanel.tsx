import React, { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { RulesConfiguration, SignRuleConfig, RoadRuleConfig, NodeDelayConfig } from '../core/types';
import { GermanSign, RoadType } from '../core/types';

// ─── Default rule configurations ────────────────────────────────────────────

/* eslint-disable-next-line react-refresh/only-export-components */
export const DEFAULT_RULES_CONFIG: RulesConfiguration = {
  signs: {
    [GermanSign.VZ_242_1]: {
      signId: GermanSign.VZ_242_1,
      name: 'Pedestrian Zone',
      description: 'Vz 242.1 – Fußgängerzone. Cyclists must dismount unless "Fahrräder frei" is posted.',
      iconCode: '🚶',
      baseSpeedKmh: 4,
      speedType: 'dismount',
      flatPenaltySeconds: 30,
      dismountRequired: true,
    },
    [GermanSign.VZ_239]: {
      signId: GermanSign.VZ_239,
      name: 'Sidewalk / Footway',
      description: 'Vz 239 – Gehweg. Cycling forbidden unless "Fahrräder frei" supplement is present.',
      iconCode: '🦶',
      baseSpeedKmh: 5,
      speedType: 'dismount',
      flatPenaltySeconds: 20,
      dismountRequired: false,
    },
    [GermanSign.VZ_240]: {
      signId: GermanSign.VZ_240,
      name: 'Shared Path',
      description: 'Vz 240 – Gemeinsamer Geh- und Radweg. Shared footway/cycleway at reduced speed.',
      iconCode: '🚶‍♂️🚲',
      baseSpeedKmh: 12,
      speedType: 'custom',
      flatPenaltySeconds: 0,
      dismountRequired: false,
    },
    [GermanSign.VZ_241]: {
      signId: GermanSign.VZ_241,
      name: 'Segregated Path',
      description: 'Vz 241 – Getrennter Geh- und Radweg. Separate tracks for pedestrians and cyclists.',
      iconCode: '🚲',
      baseSpeedKmh: 18,
      speedType: 'relative',
      flatPenaltySeconds: 0,
      dismountRequired: false,
    },
    [GermanSign.VZ_325_1]: {
      signId: GermanSign.VZ_325_1,
      name: 'Living Street',
      description: 'Vz 325.1 – Verkehrsberuhigter Bereich. Pedestrians have priority, walking speed.',
      iconCode: '🏘️',
      baseSpeedKmh: 7,
      speedType: 'relative',
      flatPenaltySeconds: 5,
      dismountRequired: false,
    },
    [GermanSign.VZ_244_1]: {
      signId: GermanSign.VZ_244_1,
      name: 'Bicycle Street',
      description: 'Vz 244.1 – Fahrradstraße. Bikes have priority, cars may use at low speed.',
      iconCode: '🚲🛣️',
      baseSpeedKmh: 20,
      speedType: 'relative',
      flatPenaltySeconds: 0,
      dismountRequired: false,
    },
  },
  roads: {
    [RoadType.PRIMARY]: {
      roadId: RoadType.PRIMARY,
      name: 'Primary Road',
      baseSpeedKmh: 14,
      speedType: 'relative',
      flatPenaltySeconds: 0,
    },
    [RoadType.SECONDARY]: {
      roadId: RoadType.SECONDARY,
      name: 'Secondary Road',
      baseSpeedKmh: 16,
      speedType: 'relative',
      flatPenaltySeconds: 0,
    },
    [RoadType.RESIDENTIAL]: {
      roadId: RoadType.RESIDENTIAL,
      name: 'Residential Street',
      baseSpeedKmh: 17,
      speedType: 'relative',
      flatPenaltySeconds: 0,
    },
    [RoadType.SERVICE]: {
      roadId: RoadType.SERVICE,
      name: 'Service Road',
      baseSpeedKmh: 11,
      speedType: 'relative',
      flatPenaltySeconds: 5,
    },
    [RoadType.PATH_DEFAULT]: {
      roadId: RoadType.PATH_DEFAULT,
      name: 'Generic Path',
      baseSpeedKmh: 18,
      speedType: 'relative',
      flatPenaltySeconds: 0,
    },
  },
  nodeDelays: {
    signalSeconds: 15,
    yieldSeconds: 3,
    stopSeconds: 8,
    crossingSeconds: 3,
  },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface IntersectionDelaySectionProps {
  config: NodeDelayConfig;
  onChange: (updated: NodeDelayConfig) => void;
}

const DELAY_FIELDS: { key: keyof NodeDelayConfig; label: string; icon: string; max: number }[] = [
  { key: 'signalSeconds',   label: 'Traffic Light',        icon: '🚦', max: 120 },
  { key: 'yieldSeconds',    label: 'Yield Sign',           icon: '⚠️', max: 60  },
  { key: 'stopSeconds',     label: 'Stop Sign',            icon: '🛑', max: 60  },
  { key: 'crossingSeconds', label: 'Pedestrian Crossing',  icon: '🚶', max: 60  },
];

const IntersectionDelaySection: React.FC<IntersectionDelaySectionProps> = ({ config, onChange }) => (
  <div className="rules-list">
    {DELAY_FIELDS.map(({ key, label, icon, max }) => (
      <div key={key} className="rules-row">
        <div className="rules-row-header">
          <span className="rules-row-name">{icon} {label}</span>
          <span className="rules-row-meta">{config[key]}s delay</span>
        </div>
        <div className="rules-controls">
          <label className="rules-label">Wait time (seconds)</label>
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={config[key]}
            onChange={e => onChange({ ...config, [key]: Number(e.target.value) })}
            className="rules-slider"
          />
        </div>
      </div>
    ))}
  </div>
);

interface SignRowProps {
  config: SignRuleConfig;
  onChange: (updated: SignRuleConfig) => void;
}

const SignRow: React.FC<SignRowProps> = ({ config, onChange }) => {
  const [expanded, setExpanded] = useState(false);

  const getEffectiveSpeedType = (cfg: SignRuleConfig): 'relative' | 'slow' | 'slower' | 'dismount' | 'custom' => {
    if (cfg.speedType) return cfg.speedType;
    const signId = cfg.signId;
    if (signId === GermanSign.VZ_241 || signId === GermanSign.VZ_244_1 || signId === GermanSign.VZ_325_1) {
      return 'relative';
    }
    if (signId === GermanSign.VZ_242_1 || signId === GermanSign.VZ_239) {
      return 'dismount';
    }
    return 'custom';
  };

  const speedType = getEffectiveSpeedType(config);

  return (
    <div className="rules-item">
      <button
        className="rules-item-header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="rules-item-icon">{config.iconCode}</span>
        <span className="rules-item-name">{config.name}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="rules-item-body">
          <p className="rules-item-desc">{config.description}</p>

          <div className="rules-field">
            <label htmlFor={`speed-type-${config.signId}`}>Speed type</label>
            <select
              id={`speed-type-${config.signId}`}
              value={speedType}
              disabled={config.dismountRequired}
              onChange={e => onChange({ ...config, speedType: e.target.value as SignRuleConfig['speedType'] })}
              className="rules-select"
            >
              <option value="relative">100% (Bike Speed)</option>
              <option value="slow">15 km/h (Slow)</option>
              <option value="slower">10 km/h (Slower)</option>
              <option value="dismount">5 km/h (Dismount)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {config.dismountRequired ? (
            <div className="rules-field" style={{ marginTop: '4px' }}>
              <span className="rules-speed-info" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Speed locked: <strong>4 km/h</strong> (Dismount required)
              </span>
            </div>
          ) : (
            speedType === 'custom' && (
              <div className="rules-field">
                <label>Base speed: <strong>{config.baseSpeedKmh} km/h</strong></label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={config.baseSpeedKmh}
                  onChange={e => onChange({ ...config, baseSpeedKmh: Number(e.target.value) })}
                  className="rules-slider"
                />
              </div>
            )
          )}

          <div className="rules-field">
            <label>Flat penalty: <strong>{config.flatPenaltySeconds}s</strong></label>
            <input
              type="range"
              min={0}
              max={300}
              step={5}
              value={config.flatPenaltySeconds}
              onChange={e => onChange({ ...config, flatPenaltySeconds: Number(e.target.value) })}
              className="rules-slider"
            />
          </div>

          <div className="rules-field rules-field--toggle">
            <label htmlFor={`dismount-${config.signId}`}>Require dismount</label>
            <input
              id={`dismount-${config.signId}`}
              type="checkbox"
              checked={config.dismountRequired}
              onChange={e => onChange({ ...config, dismountRequired: e.target.checked })}
              className="rules-checkbox"
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface RoadRowProps {
  config: RoadRuleConfig;
  onChange: (updated: RoadRuleConfig) => void;
}

const RoadRow: React.FC<RoadRowProps> = ({ config, onChange }) => {
  const [expanded, setExpanded] = useState(false);

  const getEffectiveSpeedType = (cfg: RoadRuleConfig): 'relative' | 'slow' | 'slower' | 'dismount' | 'custom' => {
    return cfg.speedType || 'relative';
  };

  const speedType = getEffectiveSpeedType(config);

  return (
    <div className="rules-item">
      <button
        className="rules-item-header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="rules-item-name">{config.name}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="rules-item-body">
          <div className="rules-field">
            <label htmlFor={`speed-type-${config.roadId}`}>Speed type</label>
            <select
              id={`speed-type-${config.roadId}`}
              value={speedType}
              onChange={e => onChange({ ...config, speedType: e.target.value as RoadRuleConfig['speedType'] })}
              className="rules-select"
            >
              <option value="relative">100% (Bike Speed)</option>
              <option value="slow">15 km/h (Slow)</option>
              <option value="slower">10 km/h (Slower)</option>
              <option value="dismount">5 km/h (Dismount)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {speedType === 'custom' && (
            <div className="rules-field">
              <label>Base speed: <strong>{config.baseSpeedKmh} km/h</strong></label>
              <input
                type="range"
                min={1}
                max={35}
                step={1}
                value={config.baseSpeedKmh}
                onChange={e => onChange({ ...config, baseSpeedKmh: Number(e.target.value) })}
                className="rules-slider"
              />
            </div>
          )}

          <div className="rules-field">
            <label>Flat penalty: <strong>{config.flatPenaltySeconds}s</strong></label>
            <input
              type="range"
              min={0}
              max={120}
              step={5}
              value={config.flatPenaltySeconds}
              onChange={e => onChange({ ...config, flatPenaltySeconds: Number(e.target.value) })}
              className="rules-slider"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Panel ──────────────────────────────────────────────────────────────

interface RulesConfigPanelProps {
  config: RulesConfiguration;
  onChange: (updated: RulesConfiguration) => void;
}

export const RulesConfigPanel: React.FC<RulesConfigPanelProps> = ({ config, onChange }) => {
  const [signsOpen, setSignsOpen] = useState(false);
  const [roadsOpen, setRoadsOpen] = useState(false);
  const [intersectionsOpen, setIntersectionsOpen] = useState(false);

  const updateSign = (signId: GermanSign, updated: SignRuleConfig) => {
    onChange({
      ...config,
      signs: { ...config.signs, [signId]: updated },
    });
  };

  const updateRoad = (roadId: RoadType, updated: RoadRuleConfig) => {
    onChange({
      ...config,
      roads: { ...config.roads, [roadId]: updated },
    });
  };

  const updateNodeDelays = (updated: NodeDelayConfig) => {
    onChange({ ...config, nodeDelays: updated });
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(DEFAULT_RULES_CONFIG);
  };

  return (
    <section className="route-card rules-panel">
      {/* Panel header */}
      <div className="rules-panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={15} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ margin: 0 }}>Road Rules</h2>
        </span>
        <button
          onClick={handleReset}
          title="Reset to defaults"
          className="rules-reset-btn"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {/* German Traffic Signs sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setSignsOpen(v => !v)}
          aria-expanded={signsOpen}
        >
          <span>🚦 Traffic Signs</span>
          {signsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {signsOpen && (
          <div className="rules-list">
            {Object.values(config.signs).map(sign => (
              <SignRow
                key={sign.signId}
                config={sign}
                onChange={updated => updateSign(sign.signId, updated)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Road Classifications sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setRoadsOpen(v => !v)}
          aria-expanded={roadsOpen}
        >
          <span>🛣️ Road Classes</span>
          {roadsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {roadsOpen && (
          <div className="rules-list">
            {Object.values(config.roads).map(road => (
              <RoadRow
                key={road.roadId}
                config={road}
                onChange={updated => updateRoad(road.roadId, updated)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Intersection delays sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setIntersectionsOpen(v => !v)}
          aria-expanded={intersectionsOpen}
        >
          <span>⏱️ Intersections</span>
          {intersectionsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {intersectionsOpen && (
          <IntersectionDelaySection
            config={config.nodeDelays}
            onChange={updateNodeDelays}
          />
        )}
      </div>
    </section>
  );
};
