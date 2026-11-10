import React, { useEffect, useRef, useState } from 'react';

import type {
  BikeProfile,
  NodeDelayConfig,
  RoadRuleConfig,
  RoadType,
  RulesConfiguration,
  SignRuleConfig,
  TurnRuleConfig,
} from '../core/config';
import { DEFAULT_RULES_CONFIG, InfrastructureType } from '../core/config';
import {
  Bike,
  Clock,
  CornerUpRight,
  Plus,
  RotateCcw,
  Route,
  TrafficCone,
  Trash2,
  X,
} from './common/Icon';
import { IntersectionDelaySection } from './IntersectionDelaySection';
import { RoadRow, SignRow } from './RulesRows';
import { TurnDelaySection } from './TurnDelaySection';

/**
 * Properties for the ProfileModal component.
 */
export interface ProfileModalProps {
  /** Whether the modal is currently rendered and visible */
  isOpen: boolean;
  /** Callback fired to close the modal */
  onClose: () => void;
  /** List of configured bike profiles */
  bikes: BikeProfile[];
  /** Identifier of the currently active bike profile for routing */
  activeBikeId: string;
  /** Callback fired when setting an active bike profile */
  onSelectBike: (id: string) => void;
  /** Callback fired when creating a new bike profile */
  onAddBike: (bike: Omit<BikeProfile, 'id'> & { id?: string }) => void;
  /** Callback fired when updating an existing bike profile */
  onUpdateBike: (id: string, updates: Partial<Omit<BikeProfile, 'id'>>) => void;
  /** Callback fired when deleting a bike profile */
  onDeleteBike: (id: string) => void;
  /** Current road rules configuration */
  rulesConfig: RulesConfiguration;
  /** Callback fired when modifying road rules configuration */
  onRulesChange: (config: RulesConfiguration) => void;
  /** Optional initial navigation section to display */
  initialSection?: 'bikes' | 'signs' | 'roads' | 'intersections' | 'turns';
}

/**
 * Two-pane profile modal managing bikes CRUD and road rules configuration.
 * Reuses the layout architecture of SettingsModal.
 *
 * @param props - Component properties.
 * @returns Rendered modal element or null when closed.
 */
export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  bikes,
  activeBikeId,
  onSelectBike,
  onAddBike,
  onUpdateBike,
  onDeleteBike,
  rulesConfig,
  onRulesChange,
  initialSection = 'bikes',
}) => {
  const [activeSection, setActiveSection] = useState<
    'bikes' | 'signs' | 'roads' | 'intersections' | 'turns'
  >(initialSection);

  const [selectedBikeId, setSelectedBikeId] = useState<string>(
    () => activeBikeId || bikes[0]?.id || '',
  );

  const prevBikesRef = useRef<BikeProfile[]>(bikes);

  // Sync active section when initialSection updates
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // Synchronize selected bike when bikes list updates or a new bike is added
  useEffect(() => {
    if (bikes.length > prevBikesRef.current.length) {
      const addedBike =
        bikes.find((b) => !prevBikesRef.current.some((pb) => pb.id === b.id)) ??
        bikes[bikes.length - 1];
      if (addedBike) {
        setSelectedBikeId(addedBike.id);
      }
    } else if (!bikes.some((b) => b.id === selectedBikeId) && bikes.length > 0) {
      setSelectedBikeId(activeBikeId || bikes[0].id);
    }
    prevBikesRef.current = bikes;
  }, [bikes, activeBikeId, selectedBikeId]);

  // Keyboard navigation & Escape dismiss handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentSelectedBike =
    bikes.find((b) => b.id === selectedBikeId) ??
    bikes.find((b) => b.id === activeBikeId) ??
    bikes[0];

  const handleAddBike = () => {
    onAddBike({
      name: 'New Bike',
      speedKmh: 20,
      surfacePreferences: {
        gravelSpeedMultiplier: 0.8,
        cobblestoneSpeedMultiplier: 0.75,
      },
      turnPenalties: {
        rightTurnPenaltySeconds: 1,
        leftTurnPenaltySeconds: 4,
        uTurnPenaltySeconds: 30,
      },
    });
  };

  const updateSign = (signId: InfrastructureType, updated: SignRuleConfig) => {
    onRulesChange({
      ...rulesConfig,
      signs: {
        ...rulesConfig.signs,
        [signId]: updated,
      },
    });
  };

  const updateRoad = (roadId: RoadType, updated: RoadRuleConfig) => {
    onRulesChange({
      ...rulesConfig,
      roads: {
        ...rulesConfig.roads,
        [roadId]: updated,
      },
    });
  };

  const updateNodeDelays = (updated: NodeDelayConfig) => {
    onRulesChange({
      ...rulesConfig,
      nodeDelays: updated,
    });
  };

  const updateTurns = (updated: TurnRuleConfig) => {
    onRulesChange({
      ...rulesConfig,
      turns: updated,
    });
  };

  return (
    <div
      className="ciclista-settings-backdrop"
      onClick={onClose}
      data-testid="profile-modal-backdrop"
    >
      <div
        className="ciclista-settings-container"
        onClick={(e) => e.stopPropagation()}
        data-testid="profile-modal"
        role="dialog"
        aria-label="Profile"
        aria-modal="true"
      >
        {/* Header */}
        <div className="ciclista-settings-header">
          <div className="ciclista-settings-title-group">
            <h2 className="ciclista-settings-title">Profile</h2>
            <span className="ciclista-settings-subtitle">Bikes and Road Rules Configuration</span>
          </div>
          <button
            type="button"
            className="ciclista-modal-close-btn"
            onClick={onClose}
            aria-label="Close Profile"
            title="Close Profile (Esc)"
            data-testid="profile-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ciclista-settings-body">
          {/* Left Sidebar */}
          <nav className="ciclista-settings-sidebar" aria-label="Profile Navigation">
            <div className="ciclista-settings-sidebar-group-title">Equipment</div>
            <button
              type="button"
              className={`ciclista-settings-sidebar-item ${activeSection === 'bikes' ? 'active' : ''}`}
              onClick={() => setActiveSection('bikes')}
              data-testid="profile-nav-bikes"
            >
              <span className="ciclista-settings-sidebar-icon">
                <Bike size={16} />
              </span>
              <span>Bikes</span>
            </button>

            <div className="ciclista-settings-sidebar-group-title ciclista-settings-sidebar-group-title--spaced">
              Road Rules
            </div>
            <button
              type="button"
              className={`ciclista-settings-sidebar-item ${activeSection === 'signs' ? 'active' : ''}`}
              onClick={() => setActiveSection('signs')}
              data-testid="profile-nav-signs"
            >
              <span className="ciclista-settings-sidebar-icon">
                <TrafficCone size={16} />
              </span>
              <span>Traffic Signs</span>
            </button>
            <button
              type="button"
              className={`ciclista-settings-sidebar-item ${activeSection === 'roads' ? 'active' : ''}`}
              onClick={() => setActiveSection('roads')}
              data-testid="profile-nav-roads"
            >
              <span className="ciclista-settings-sidebar-icon">
                <Route size={16} />
              </span>
              <span>Road Classes</span>
            </button>
            <button
              type="button"
              className={`ciclista-settings-sidebar-item ${activeSection === 'intersections' ? 'active' : ''}`}
              onClick={() => setActiveSection('intersections')}
              data-testid="profile-nav-intersections"
            >
              <span className="ciclista-settings-sidebar-icon">
                <Clock size={16} />
              </span>
              <span>Intersections</span>
            </button>
            <button
              type="button"
              className={`ciclista-settings-sidebar-item ${activeSection === 'turns' ? 'active' : ''}`}
              onClick={() => setActiveSection('turns')}
              data-testid="profile-nav-turns"
            >
              <span className="ciclista-settings-sidebar-icon">
                <CornerUpRight size={16} />
              </span>
              <span>Turn Penalties</span>
            </button>
          </nav>

          {/* Right Content Pane */}
          <div className="ciclista-settings-content">
            {activeSection === 'bikes' && (
              <div className="ciclista-profile-bikes-section">
                <div className="ciclista-profile-section-header">
                  <h3 className="ciclista-settings-section-header-title">Bikes</h3>
                  <button
                    type="button"
                    className="ciclista-btn ciclista-btn--primary ciclista-btn--sm"
                    onClick={handleAddBike}
                    data-testid="profile-add-bike-btn"
                  >
                    <Plus size={14} />+ Add Bike
                  </button>
                </div>

                {/* Bike list tabs */}
                <div
                  className="ciclista-bike-tabs-list"
                  role="tablist"
                  aria-label="Configured bikes"
                >
                  {bikes.map((bike) => {
                    const isSelected = bike.id === currentSelectedBike?.id;
                    const isActive = bike.id === activeBikeId;
                    return (
                      <div
                        key={bike.id}
                        role="tab"
                        aria-selected={isSelected}
                        className={`ciclista-bike-tab-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedBikeId(bike.id)}
                        data-testid={`profile-bike-item-${bike.id}`}
                      >
                        <div className="ciclista-bike-tab-info">
                          <span className="ciclista-bike-tab-name">{bike.name}</span>
                          <span className="ciclista-bike-tab-speed">{bike.speedKmh} km/h</span>
                        </div>
                        <div className="ciclista-bike-tab-status">
                          {isActive ? (
                            <span
                              className="badge-chip badge-bike"
                              data-testid={`profile-bike-active-${bike.id}`}
                            >
                              Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="ciclista-btn ciclista-btn--secondary ciclista-btn--xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectBike(bike.id);
                              }}
                              data-testid={`profile-activate-bike-${bike.id}`}
                              aria-label={`Set ${bike.name} as active bike`}
                            >
                              Use
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Editor Form for currently selected bike */}
                {currentSelectedBike ? (
                  <div className="ciclista-bike-form">
                    <div className="ciclista-form-field">
                      <label htmlFor="profile-bike-name" className="ciclista-label">
                        Name
                      </label>
                      <input
                        id="profile-bike-name"
                        name="bikeName"
                        type="text"
                        className="ciclista-input"
                        value={currentSelectedBike.name}
                        onChange={(e) =>
                          onUpdateBike(currentSelectedBike.id, { name: e.target.value })
                        }
                        data-testid="profile-bike-name-input"
                      />
                    </div>

                    <div className="ciclista-grid-2col">
                      <div className="ciclista-form-field">
                        <label htmlFor="profile-bike-speed" className="ciclista-label">
                          Speed (km/h)
                        </label>
                        <input
                          id="profile-bike-speed"
                          name="bikeSpeed"
                          type="number"
                          className="ciclista-input"
                          value={currentSelectedBike.speedKmh}
                          onChange={(e) =>
                            onUpdateBike(currentSelectedBike.id, {
                              speedKmh: e.target.value === '' ? 0 : Number(e.target.value),
                            })
                          }
                          data-testid="profile-bike-speed-input"
                        />
                      </div>

                      <div className="ciclista-form-field">
                        <label htmlFor="profile-bike-weight" className="ciclista-label">
                          Weight (kg, optional)
                        </label>
                        <input
                          id="profile-bike-weight"
                          name="bikeWeight"
                          type="number"
                          className="ciclista-input"
                          value={currentSelectedBike.weightKg ?? ''}
                          onChange={(e) =>
                            onUpdateBike(currentSelectedBike.id, {
                              weightKg: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                          data-testid="profile-bike-weight-input"
                        />
                      </div>
                    </div>

                    <div className="ciclista-grid-2col">
                      <div className="ciclista-form-field">
                        <label htmlFor="profile-bike-gravel" className="ciclista-label">
                          Gravel Multiplier
                        </label>
                        <input
                          id="profile-bike-gravel"
                          name="bikeGravel"
                          type="number"
                          step={0.05}
                          className="ciclista-input"
                          value={
                            currentSelectedBike.surfacePreferences?.gravelSpeedMultiplier ?? ''
                          }
                          onChange={(e) =>
                            onUpdateBike(currentSelectedBike.id, {
                              surfacePreferences: {
                                ...currentSelectedBike.surfacePreferences,
                                gravelSpeedMultiplier:
                                  e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })
                          }
                          data-testid="profile-bike-gravel-input"
                        />
                      </div>

                      <div className="ciclista-form-field">
                        <label htmlFor="profile-bike-cobblestone" className="ciclista-label">
                          Cobblestone Multiplier
                        </label>
                        <input
                          id="profile-bike-cobblestone"
                          name="bikeCobblestone"
                          type="number"
                          step={0.05}
                          className="ciclista-input"
                          value={
                            currentSelectedBike.surfacePreferences?.cobblestoneSpeedMultiplier ?? ''
                          }
                          onChange={(e) =>
                            onUpdateBike(currentSelectedBike.id, {
                              surfacePreferences: {
                                ...currentSelectedBike.surfacePreferences,
                                cobblestoneSpeedMultiplier:
                                  e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })
                          }
                          data-testid="profile-bike-cobblestone-input"
                        />
                      </div>
                    </div>

                    <div className="ciclista-grid-2col">
                      <div className="ciclista-form-field">
                        <label htmlFor="profile-bike-right-turn" className="ciclista-label">
                          Right Turn Penalty (s)
                        </label>
                        <input
                          id="profile-bike-right-turn"
                          name="bikeRightTurn"
                          type="number"
                          className="ciclista-input"
                          value={currentSelectedBike.turnPenalties?.rightTurnPenaltySeconds ?? ''}
                          onChange={(e) =>
                            onUpdateBike(currentSelectedBike.id, {
                              turnPenalties: {
                                ...currentSelectedBike.turnPenalties,
                                rightTurnPenaltySeconds:
                                  e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })
                          }
                          data-testid="profile-bike-right-turn-input"
                        />
                      </div>

                      <div className="ciclista-form-field">
                        <label htmlFor="profile-bike-left-turn" className="ciclista-label">
                          Left Turn Penalty (s)
                        </label>
                        <input
                          id="profile-bike-left-turn"
                          name="bikeLeftTurn"
                          type="number"
                          className="ciclista-input"
                          value={currentSelectedBike.turnPenalties?.leftTurnPenaltySeconds ?? ''}
                          onChange={(e) =>
                            onUpdateBike(currentSelectedBike.id, {
                              turnPenalties: {
                                ...currentSelectedBike.turnPenalties,
                                leftTurnPenaltySeconds:
                                  e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })
                          }
                          data-testid="profile-bike-left-turn-input"
                        />
                      </div>
                    </div>

                    <div className="ciclista-bike-form-actions">
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--danger"
                        disabled={bikes.length <= 1}
                        onClick={() => {
                          const nextBike = bikes.find((b) => b.id !== currentSelectedBike.id);
                          if (nextBike) {
                            setSelectedBikeId(nextBike.id);
                          }
                          onDeleteBike(currentSelectedBike.id);
                        }}
                        data-testid="profile-delete-bike-btn"
                      >
                        <Trash2 size={14} />
                        Delete Bike
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ciclista-settings-empty">No bikes configured.</div>
                )}
              </div>
            )}

            {activeSection !== 'bikes' && (
              <div className="ciclista-profile-rules-section">
                <div className="ciclista-profile-section-header">
                  <h3 className="ciclista-settings-section-header-title">
                    {activeSection === 'signs' && 'Traffic Signs'}
                    {activeSection === 'roads' && 'Road Classes'}
                    {activeSection === 'intersections' && 'Intersections'}
                    {activeSection === 'turns' && 'Turn Penalties'}
                  </h3>
                  <button
                    type="button"
                    className="ciclista-btn ciclista-btn--secondary ciclista-btn--sm"
                    onClick={() => onRulesChange(DEFAULT_RULES_CONFIG)}
                    data-testid="profile-reset-rules-btn"
                  >
                    <RotateCcw size={14} />
                    Reset Rules to Defaults
                  </button>
                </div>

                {activeSection === 'signs' && (
                  <div className="rules-list" data-testid="profile-signs-list">
                    {Object.values(rulesConfig.signs).map((sign) => (
                      <SignRow
                        key={sign.signId}
                        config={sign}
                        onChange={(updated) => updateSign(sign.signId, updated)}
                      />
                    ))}
                  </div>
                )}

                {activeSection === 'roads' && (
                  <div className="rules-list" data-testid="profile-roads-list">
                    {Object.values(rulesConfig.roads).map((road) => (
                      <RoadRow
                        key={road.roadId}
                        config={road}
                        onChange={(updated) => updateRoad(road.roadId, updated)}
                      />
                    ))}
                  </div>
                )}

                {activeSection === 'intersections' && (
                  <div data-testid="profile-intersections-section">
                    <IntersectionDelaySection
                      config={rulesConfig.nodeDelays}
                      onChange={updateNodeDelays}
                    />
                  </div>
                )}

                {activeSection === 'turns' && (
                  <div data-testid="profile-turns-section">
                    <TurnDelaySection config={rulesConfig.turns} onChange={updateTurns} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="ciclista-settings-footer">
          <button
            type="button"
            className="ciclista-btn ciclista-btn--primary"
            onClick={onClose}
            data-testid="profile-done-btn"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
