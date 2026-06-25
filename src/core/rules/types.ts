import type { ComfortLevel, InfrastructureType, RoadType } from '../config';

/**
 * Resolved numerical metrics for a single map feature used during cost calculations.
 */
export interface ResolvedEdgeImpact {
  effectiveSpeedMs: number;
  flatPenaltySeconds: number;
  comfort: ComfortLevel;
}

/**
 * Resolved edge impacts mapped by infrastructure type.
 */
export type RouterSignImpacts = Record<InfrastructureType, ResolvedEdgeImpact>;

/**
 * Resolved edge impacts mapped by road classification.
 */
export type RouterRoadImpacts = Record<RoadType, ResolvedEdgeImpact>;
