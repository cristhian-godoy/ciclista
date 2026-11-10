import React, { useState } from 'react';

import type { BikeConfig, BikeProfileId, RulesConfiguration } from '../core/config';
import { Bike, Check, RotateCcw, Settings, Sliders, Zap } from './common/Icon';
import { Modal } from './common/Modal';
import { SegmentedControl } from './common/SegmentedControl';
import { RulesConfigPanel } from './RulesConfigPanel';

/**
 * Properties for the BikeProfileRulesModal component.
 */
export interface BikeProfileRulesModalProps {
  /**
   * Whether the modal dialog is currently visible.
   */
  isOpen: boolean;
  /**
   * Callback fired when closing the modal dialog.
   */
  onClose: () => void;
  /**
   * Active bike configuration to display and tune.
   */
  bikeConfig: BikeConfig;
  /**
   * Callback invoked when bike configuration values change.
   */
  onBikeConfigChange: (config: BikeConfig) => void;
  /**
   * Active road rules and traffic infrastructure configuration.
   */
  rulesConfig: RulesConfiguration;
  /**
   * Callback invoked when road rules configuration values change.
   */
  onRulesChange: (config: RulesConfiguration) => void;
  /**
   * Optional initial active tab ('bike' or 'rules'). Defaults to 'bike'.
   */
  initialTab?: 'bike' | 'rules';
}

/**
 * Returns a user-friendly description of the chosen bike profile preset.
 *
 * @param id - Bike profile identifier.
 * @returns Text description outlining riding speed and behavioral characteristics.
 */
function getProfileDescription(id: BikeProfileId): string {
  switch (id) {
    case 'road':
      return 'High-speed road bicycle optimized for asphalt surfaces with low turn delays and strong penalties on unpaved roads.';
    case 'ebike':
      return 'Motorized electric assist bicycle maintaining rapid cruising speed and effortless acceleration uphill.';
    case 'slow':
      return 'Heavy utility or cargo bicycle with lower cruising velocity and wider turning radiuses.';
    case 'custom':
      return 'Customized individual setup allowing fine-grained override of speed, total weight, turn penalties, and surface multipliers.';
    case 'normal':
    default:
      return 'Balanced commuter bicycle profile with standard city cruising speed and moderate turning delays.';
  }
}

/**
 * Dedicated modal management dialog for configuring bike profiles (speed, weight,
 * turn penalties, surface factors) and fine-tuning road rules and traffic infrastructure.
 */
export const BikeProfileRulesModal: React.FC<BikeProfileRulesModalProps> = ({
  isOpen,
  onClose,
  bikeConfig,
  onBikeConfigChange,
  rulesConfig,
  onRulesChange,
  initialTab = 'bike',
}) => {
  const [activeTab, setActiveTab] = useState<'bike' | 'rules'>(initialTab);

  if (!isOpen) return null;

  const currentSpeed =
    bikeConfig.customSpeedKmh ??
    (bikeConfig.id === 'road'
      ? 30
      : bikeConfig.id === 'ebike'
        ? 25
        : bikeConfig.id === 'slow'
          ? 15
          : 18);

  const currentWeight = bikeConfig.weightKg ?? 75;
  const currentRightTurn = bikeConfig.turnPenalties?.rightTurnPenaltySeconds ?? 1;
  const currentLeftTurn = bikeConfig.turnPenalties?.leftTurnPenaltySeconds ?? 4;
  const currentGravel =
    bikeConfig.surfacePreferences?.gravelSpeedMultiplier ?? (bikeConfig.id === 'road' ? 0.4 : 0.8);
  const currentCobblestone =
    bikeConfig.surfacePreferences?.cobblestoneSpeedMultiplier ??
    (bikeConfig.id === 'road' ? 0.6 : 0.75);

  const handleResetBike = () => {
    onBikeConfigChange({
      id: bikeConfig.id,
      customSpeedKmh: undefined,
      weightKg: undefined,
      turnPenalties: undefined,
      surfacePreferences: undefined,
    });
  };

  const modalTitle = (
    <div className="ciclista-modal-title-with-icon">
      <Sliders size={18} className="ciclista-modal-title-icon" />
      <span>Bike Setup &amp; Road Rules</span>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      className="ciclista-bike-rules-modal"
      ariaLabel="Bike Setup and Road Rules"
    >
      <div className="ciclista-bike-rules-tabs">
        <SegmentedControl
          options={[
            {
              key: 'bike',
              label: 'Bike Profile',
              icon: <Bike size={13} aria-label="Bike Profile Icon" />,
            },
            {
              key: 'rules',
              label: 'Road Rules',
              icon: <Settings size={13} aria-label="Road Rules Icon" />,
            },
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as 'bike' | 'rules')}
          ariaLabel="Management View Tabs"
        />
      </div>

      {activeTab === 'bike' ? (
        <div className="ciclista-bike-profile-manager">
          <div className="ciclista-form-group">
            <label className="ciclista-label">Preset Profile</label>
            <SegmentedControl
              options={[
                {
                  key: 'normal',
                  label: 'Standard',
                  icon: <Bike size={12} aria-label="Standard Icon" />,
                },
                {
                  key: 'road',
                  label: 'Road',
                  icon: <Zap size={12} aria-label="Road Icon" />,
                },
                {
                  key: 'ebike',
                  label: 'E-Bike',
                  icon: <Zap size={12} aria-label="E-Bike Icon" />,
                },
                {
                  key: 'slow',
                  label: 'Cargo',
                  icon: <Bike size={12} aria-label="Cargo Icon" />,
                },
                {
                  key: 'custom',
                  label: 'Custom',
                  icon: <Settings size={12} aria-label="Custom Icon" />,
                },
              ]}
              value={bikeConfig.id}
              onChange={(id) => onBikeConfigChange({ ...bikeConfig, id: id as BikeProfileId })}
              showDescription={false}
              ariaLabel="Bike Profile Selector"
            />
            <p className="ciclista-bike-profile-desc">{getProfileDescription(bikeConfig.id)}</p>
          </div>

          <div className="ciclista-card ciclista-bike-tuning-card">
            <div className="ciclista-form-group">
              <label className="ciclista-label" htmlFor="custom-bike-speed">
                Speed (km/h)
              </label>
              <input
                id="custom-bike-speed"
                className="ciclista-input"
                type="number"
                min={5}
                max={60}
                value={currentSpeed}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onBikeConfigChange({
                    ...bikeConfig,
                    customSpeedKmh: isNaN(val) ? undefined : val,
                  });
                }}
              />
            </div>

            <div className="ciclista-form-group">
              <label className="ciclista-label" htmlFor="custom-bike-weight">
                Weight (kg)
              </label>
              <input
                id="custom-bike-weight"
                className="ciclista-input"
                type="number"
                min={5}
                max={200}
                value={currentWeight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onBikeConfigChange({
                    ...bikeConfig,
                    weightKg: isNaN(val) ? undefined : val,
                  });
                }}
              />
            </div>

            <div className="ciclista-form-group">
              <label className="ciclista-label">Turn Penalties (seconds)</label>
              <div className="ciclista-grid-2col">
                <div>
                  <label
                    className="ciclista-label ciclista-label--sm"
                    htmlFor="custom-right-turn-penalty"
                  >
                    Right Turn
                  </label>
                  <input
                    id="custom-right-turn-penalty"
                    className="ciclista-input"
                    type="number"
                    min={0}
                    max={60}
                    value={currentRightTurn}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBikeConfigChange({
                        ...bikeConfig,
                        turnPenalties: {
                          ...bikeConfig.turnPenalties,
                          rightTurnPenaltySeconds: isNaN(val) ? 0 : val,
                        },
                      });
                    }}
                  />
                </div>
                <div>
                  <label
                    className="ciclista-label ciclista-label--sm"
                    htmlFor="custom-left-turn-penalty"
                  >
                    Left Turn
                  </label>
                  <input
                    id="custom-left-turn-penalty"
                    className="ciclista-input"
                    type="number"
                    min={0}
                    max={60}
                    value={currentLeftTurn}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBikeConfigChange({
                        ...bikeConfig,
                        turnPenalties: {
                          ...bikeConfig.turnPenalties,
                          leftTurnPenaltySeconds: isNaN(val) ? 0 : val,
                        },
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="ciclista-form-group">
              <label className="ciclista-label">Surface Multipliers</label>
              <div className="ciclista-grid-2col">
                <div>
                  <label
                    className="ciclista-label ciclista-label--sm"
                    htmlFor="custom-gravel-multiplier"
                  >
                    Gravel
                  </label>
                  <input
                    id="custom-gravel-multiplier"
                    className="ciclista-input"
                    type="number"
                    step={0.05}
                    min={0.1}
                    max={1}
                    value={currentGravel}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBikeConfigChange({
                        ...bikeConfig,
                        surfacePreferences: {
                          ...bikeConfig.surfacePreferences,
                          gravelSpeedMultiplier: isNaN(val) ? 0.8 : val,
                        },
                      });
                    }}
                  />
                </div>
                <div>
                  <label
                    className="ciclista-label ciclista-label--sm"
                    htmlFor="custom-cobblestone-multiplier"
                  >
                    Cobblestone
                  </label>
                  <input
                    id="custom-cobblestone-multiplier"
                    className="ciclista-input"
                    type="number"
                    step={0.05}
                    min={0.1}
                    max={1}
                    value={currentCobblestone}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onBikeConfigChange({
                        ...bikeConfig,
                        surfacePreferences: {
                          ...bikeConfig.surfacePreferences,
                          cobblestoneSpeedMultiplier: isNaN(val) ? 0.75 : val,
                        },
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="ciclista-bike-reset-row">
              <button
                type="button"
                className="ciclista-btn ciclista-btn--secondary ciclista-btn--sm"
                onClick={handleResetBike}
                title="Reset profile tuning parameters to standard defaults"
              >
                <RotateCcw size={12} />
                <span>Reset Profile Parameters</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="ciclista-rules-panel-wrapper">
          <RulesConfigPanel config={rulesConfig} onChange={onRulesChange} defaultOpen={true} />
        </div>
      )}

      <div className="ciclista-modal-footer-actions">
        <button
          type="button"
          className="ciclista-btn ciclista-btn--primary"
          onClick={onClose}
          data-testid="bike-rules-modal-done-btn"
        >
          <Check size={14} />
          <span>Done</span>
        </button>
      </div>
    </Modal>
  );
};
