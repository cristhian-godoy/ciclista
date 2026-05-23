import React, { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type {
  RulesConfiguration,
  SignRuleConfig,
  RoadRuleConfig,
  NodeDelayConfig,
} from '../core/router/types';
import { GermanSign, RoadType } from '../core/router/types';
import { IntersectionDelaySection } from './IntersectionDelaySection';
import { SignRow, RoadRow } from './RulesRows';

// ─── Default rule configurations ────────────────────────────────────────────

/* eslint-disable-next-line react-refresh/only-export-components */
export const DEFAULT_RULES_CONFIG: RulesConfiguration = {
  signs: {
    [GermanSign.VZ_242_1]: {
      signId: GermanSign.VZ_242_1,
      name: 'Pedestrian Zone',
      description:
        'Vz 242.1 – Fußgängerzone. Cyclists must dismount unless "Fahrräder frei" is posted.',
      iconCode: '🚶',
      baseSpeedKmh: 4,
      speedType: 'dismount',
      flatPenaltySeconds: 30,
      comfort: 'low',
    },
    [GermanSign.VZ_239]: {
      signId: GermanSign.VZ_239,
      name: 'Sidewalk / Footway',
      description:
        'Vz 239 – Gehweg. Cycling forbidden unless "Fahrräder frei" supplement is present.',
      iconCode: '🦶',
      baseSpeedKmh: 4,
      speedType: 'dismount',
      flatPenaltySeconds: 20,
      comfort: 'low',
    },
    [GermanSign.VZ_240]: {
      signId: GermanSign.VZ_240,
      name: 'Shared Path',
      description:
        'Vz 240 – Gemeinsamer Geh- und Radweg. Shared footway/cycleway at reduced speed.',
      iconCode: '🚶‍♂️🚲',
      baseSpeedKmh: 15,
      speedType: 'slow',
      flatPenaltySeconds: 0,
      comfort: 'high',
    },
    [GermanSign.VZ_241]: {
      signId: GermanSign.VZ_241,
      name: 'Segregated Path',
      description:
        'Vz 241 – Getrennter Geh- und Radweg. Separate tracks for pedestrians and cyclists.',
      iconCode: '🚲',
      baseSpeedKmh: 18,
      speedType: 'relative',
      flatPenaltySeconds: 0,
      comfort: 'very_high',
    },
    [GermanSign.VZ_325_1]: {
      signId: GermanSign.VZ_325_1,
      name: 'Living Street',
      description:
        'Vz 325.1 – Verkehrsberuhigter Bereich. Pedestrians have priority, walking speed.',
      iconCode: '🏘️',
      baseSpeedKmh: 7,
      speedType: 'relative',
      flatPenaltySeconds: 5,
      comfort: 'high',
    },
    [GermanSign.VZ_244_1]: {
      signId: GermanSign.VZ_244_1,
      name: 'Bicycle Street',
      description: 'Vz 244.1 – Fahrradstraße. Bikes have priority, cars may use at low speed.',
      iconCode: '🚲🛣️',
      baseSpeedKmh: 20,
      speedType: 'relative',
      flatPenaltySeconds: 0,
      comfort: 'very_high',
    },
  },
  roads: {
    [RoadType.PRIMARY]: {
      roadId: RoadType.PRIMARY,
      name: 'Primary Road',
      baseSpeedKmh: 14,
      speedType: 'relative',
      flatPenaltySeconds: 0,
      comfort: 'very_low',
    },
    [RoadType.SECONDARY]: {
      roadId: RoadType.SECONDARY,
      name: 'Secondary Road',
      baseSpeedKmh: 16,
      speedType: 'relative',
      flatPenaltySeconds: 0,
      comfort: 'low',
    },
    [RoadType.RESIDENTIAL]: {
      roadId: RoadType.RESIDENTIAL,
      name: 'Residential Street',
      baseSpeedKmh: 17,
      speedType: 'relative',
      flatPenaltySeconds: 0,
      comfort: 'high',
    },
    [RoadType.SERVICE]: {
      roadId: RoadType.SERVICE,
      name: 'Service Road',
      baseSpeedKmh: 11,
      speedType: 'relative',
      flatPenaltySeconds: 5,
      comfort: 'neutral',
    },
    [RoadType.PATH_DEFAULT]: {
      roadId: RoadType.PATH_DEFAULT,
      name: 'Generic Path',
      baseSpeedKmh: 18,
      speedType: 'relative',
      flatPenaltySeconds: 0,
      comfort: 'high',
    },
  },
  nodeDelays: {
    signalSeconds: 15,
    yieldSeconds: 3,
    stopSeconds: 8,
    crossingSeconds: 3,
  },
};

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
        <button onClick={handleReset} title="Reset to defaults" className="rules-reset-btn">
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {/* German Traffic Signs sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setSignsOpen((v) => !v)}
          aria-expanded={signsOpen}
        >
          <span>🚦 Traffic Signs</span>
          {signsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {signsOpen && (
          <div className="rules-list">
            {Object.values(config.signs).map((sign) => (
              <SignRow
                key={sign.signId}
                config={sign}
                onChange={(updated) => updateSign(sign.signId, updated)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Road Classifications sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setRoadsOpen((v) => !v)}
          aria-expanded={roadsOpen}
        >
          <span>🛣️ Road Classes</span>
          {roadsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {roadsOpen && (
          <div className="rules-list">
            {Object.values(config.roads).map((road) => (
              <RoadRow
                key={road.roadId}
                config={road}
                onChange={(updated) => updateRoad(road.roadId, updated)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Intersection delays sub-section */}
      <div className="rules-section">
        <button
          className="rules-section-toggle"
          onClick={() => setIntersectionsOpen((v) => !v)}
          aria-expanded={intersectionsOpen}
        >
          <span>⏱️ Intersections</span>
          {intersectionsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {intersectionsOpen && (
          <IntersectionDelaySection config={config.nodeDelays} onChange={updateNodeDelays} />
        )}
      </div>
    </section>
  );
};
