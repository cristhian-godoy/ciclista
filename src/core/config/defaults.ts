import type { RulesConfiguration } from './types';
import { InfrastructureType, RoadType } from './types';

/**
 * Default rules and speed configuration for cycling path calculations.
 */
export const DEFAULT_RULES_CONFIG: RulesConfiguration = {
  signs: {
    [InfrastructureType.PEDESTRIAN_ZONE]: {
      signId: InfrastructureType.PEDESTRIAN_ZONE,
      name: 'Pedestrian Zone',
      description:
        'A zone designated for pedestrian use. Cyclists must dismount unless supplementary signs permit cycling.',
      iconCode: '🚶',
      baseSpeedKmh: 4,
      speedType: 'dismount',
      flatPenaltySeconds: 30,
      comfort: 'low',
    },
    [InfrastructureType.SIDEWALK]: {
      signId: InfrastructureType.SIDEWALK,
      name: 'Sidewalk / Footway',
      description:
        'A walkway adjacent to roads or park paths. Cycling is generally forbidden unless explicitly allowed.',
      iconCode: '🦶',
      baseSpeedKmh: 4,
      speedType: 'dismount',
      flatPenaltySeconds: 20,
      comfort: 'low',
    },
    [InfrastructureType.SHARED_PATH]: {
      signId: InfrastructureType.SHARED_PATH,
      name: 'Shared Path',
      description:
        'A shared walkway and cycleway where pedestrians and cyclists mix. Reduced speed recommended.',
      iconCode: '🚶‍♂️🚲',
      baseSpeedKmh: 15,
      speedType: 'slow',
      flatPenaltySeconds: 0,
      comfort: 'high',
    },
    [InfrastructureType.SEGREGATED_PATH]: {
      signId: InfrastructureType.SEGREGATED_PATH,
      name: 'Segregated Path',
      description: 'A path with separate parallel tracks designated for pedestrians and cyclists.',
      iconCode: '🚲',
      baseSpeedKmh: 18,
      speedType: 'relative',
      flatPenaltySeconds: 0,
      comfort: 'very_high',
    },
    [InfrastructureType.LIVING_STREET]: {
      signId: InfrastructureType.LIVING_STREET,
      name: 'Living Street',
      description:
        'A traffic-calmed residential street. Pedestrians have priority and vehicles must travel at walking pace.',
      iconCode: '🏘️',
      baseSpeedKmh: 7,
      speedType: 'relative',
      flatPenaltySeconds: 5,
      comfort: 'high',
    },
    [InfrastructureType.BICYCLE_STREET]: {
      signId: InfrastructureType.BICYCLE_STREET,
      name: 'Bicycle Street',
      description:
        'A street where cyclists have priority and motor traffic is restricted or slowed.',
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
  turns: {
    rightTurnPenaltySeconds: 1,
    leftTurnPenaltySeconds: 4,
    greenArrowRightTurnSeconds: 0,
    indirectLeftTurnSeconds: 15,
    uTurnPenaltySeconds: 30,
  },
};
