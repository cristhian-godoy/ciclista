import { describe, expect, it } from 'vitest';

import { InfrastructureType, RoadType } from '../config';
import {
  getEffectiveRoadSpeedType,
  getEffectiveSignSpeedType,
  getSurfaceType,
  hasCycleway,
  mapOSMNodeToControl,
  mapOSMToSignAndRoad,
} from './osm-mapper';

describe('mapOSMToSignAndRoad', () => {
  // ── Bicycle street ─────────────────────────────────────────────────────────
  it('maps bicycle_road=yes to BICYCLE_STREET', () => {
    const r = mapOSMToSignAndRoad('residential', { bicycle_road: 'yes' });
    expect(r.sign).toBe(InfrastructureType.BICYCLE_STREET);
    expect(r.bicycleFrei).toBe(true);
  });

  it('maps highway=cycleway to SEGREGATED_PATH', () => {
    const r = mapOSMToSignAndRoad('cycleway', {});
    expect(r.sign).toBe(InfrastructureType.SEGREGATED_PATH);
    expect(r.road).toBe(RoadType.PATH_DEFAULT);
    expect(r.bicycleFrei).toBe(true);
  });

  // ── Living street ─────────────────────────────────────────────────────────
  it('maps living_street to LIVING_STREET', () => {
    const r = mapOSMToSignAndRoad('living_street', {});
    expect(r.sign).toBe(InfrastructureType.LIVING_STREET);
    expect(r.road).toBe(RoadType.RESIDENTIAL);
    expect(r.bicycleFrei).toBe(true);
  });

  // ── Shared / segregated path ──────────────────────────────────────────────
  it('maps path with bicycle=designated + foot=designated + segregated=yes to SEGREGATED_PATH', () => {
    const r = mapOSMToSignAndRoad('path', {
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'yes',
    });
    expect(r.sign).toBe(InfrastructureType.SEGREGATED_PATH);
    expect(r.bicycleFrei).toBe(true);
  });

  it('maps path with bicycle=designated + foot=designated (no segregated) to SHARED_PATH', () => {
    const r = mapOSMToSignAndRoad('path', {
      bicycle: 'designated',
      foot: 'designated',
    });
    expect(r.sign).toBe(InfrastructureType.SHARED_PATH);
  });

  it('maps generic path with no bicycle tag to bicycleFrei=false', () => {
    const r = mapOSMToSignAndRoad('path', {});
    expect(r.sign).toBeNull();
    expect(r.bicycleFrei).toBe(false);
  });

  it('maps track with bicycle=yes to bicycleFrei=true', () => {
    const r = mapOSMToSignAndRoad('track', { bicycle: 'yes' });
    expect(r.sign).toBeNull();
    expect(r.bicycleFrei).toBe(true);
  });

  // ── Pedestrian zone ───────────────────────────────────────────────────────
  it('maps pedestrian without bicycle tag to PEDESTRIAN_ZONE with bicycleFrei=false', () => {
    const r = mapOSMToSignAndRoad('pedestrian', {});
    expect(r.sign).toBe(InfrastructureType.PEDESTRIAN_ZONE);
    expect(r.bicycleFrei).toBe(false);
  });

  it('maps pedestrian with bicycle=yes to PEDESTRIAN_ZONE with bicycleFrei=true', () => {
    const r = mapOSMToSignAndRoad('pedestrian', { bicycle: 'yes' });
    expect(r.sign).toBe(InfrastructureType.PEDESTRIAN_ZONE);
    expect(r.bicycleFrei).toBe(true);
  });

  // ── Footway / sidewalk ────────────────────────────────────────────────────
  it('maps footway without bicycle tag to SIDEWALK with bicycleFrei=false', () => {
    const r = mapOSMToSignAndRoad('footway', {});
    expect(r.sign).toBe(InfrastructureType.SIDEWALK);
    expect(r.bicycleFrei).toBe(false);
  });

  it('maps footway with bicycle=designated to SIDEWALK with bicycleFrei=true', () => {
    const r = mapOSMToSignAndRoad('footway', { bicycle: 'designated' });
    expect(r.sign).toBe(InfrastructureType.SIDEWALK);
    expect(r.bicycleFrei).toBe(true);
  });

  it('maps footway with both bicycle and foot designated to SHARED_PATH/SEGREGATED_PATH', () => {
    const shared = mapOSMToSignAndRoad('footway', { bicycle: 'designated', foot: 'designated' });
    expect(shared.sign).toBe(InfrastructureType.SHARED_PATH);

    const segregated = mapOSMToSignAndRoad('footway', {
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'yes',
    });
    expect(segregated.sign).toBe(InfrastructureType.SEGREGATED_PATH);
  });

  // ── Road classifications ──────────────────────────────────────────────────
  it('maps primary to RoadType.PRIMARY with no sign', () => {
    const r = mapOSMToSignAndRoad('primary', {});
    expect(r.sign).toBeNull();
    expect(r.road).toBe(RoadType.PRIMARY);
  });

  it('maps primary_link to RoadType.PRIMARY', () => {
    const r = mapOSMToSignAndRoad('primary_link', {});
    expect(r.road).toBe(RoadType.PRIMARY);
  });

  it('maps secondary to RoadType.SECONDARY', () => {
    const r = mapOSMToSignAndRoad('secondary', {});
    expect(r.road).toBe(RoadType.SECONDARY);
  });

  it('maps residential to RoadType.RESIDENTIAL', () => {
    const r = mapOSMToSignAndRoad('residential', {});
    expect(r.road).toBe(RoadType.RESIDENTIAL);
  });

  it('maps tertiary to RoadType.RESIDENTIAL', () => {
    const r = mapOSMToSignAndRoad('tertiary', {});
    expect(r.road).toBe(RoadType.RESIDENTIAL);
  });

  it('maps unclassified to RoadType.RESIDENTIAL', () => {
    const r = mapOSMToSignAndRoad('unclassified', {});
    expect(r.road).toBe(RoadType.RESIDENTIAL);
  });

  it('maps service to RoadType.SERVICE', () => {
    const r = mapOSMToSignAndRoad('service', {});
    expect(r.road).toBe(RoadType.SERVICE);
  });

  // ── Fallback ──────────────────────────────────────────────────────────────
  it('maps unknown highway to PATH_DEFAULT with no sign', () => {
    const r = mapOSMToSignAndRoad('construction', {});
    expect(r.sign).toBeNull();
    expect(r.road).toBe(RoadType.PATH_DEFAULT);
  });
});

describe('mapOSMNodeToControl', () => {
  it('classifies traffic signals', () => {
    expect(mapOSMNodeToControl({ highway: 'traffic_signals' })).toBe('signal');
    expect(mapOSMNodeToControl({ crossing: 'traffic_signals' })).toBe('signal');
    expect(mapOSMNodeToControl({ crossing: 'controlled' })).toBe('signal');
  });

  it('classifies give way signs as yield', () => {
    expect(mapOSMNodeToControl({ highway: 'give_way' })).toBe('yield');
  });

  it('classifies stop signs as stop', () => {
    expect(mapOSMNodeToControl({ highway: 'stop' })).toBe('stop');
  });

  it('classifies crossings', () => {
    expect(mapOSMNodeToControl({ crossing: 'zebra' })).toBe('crossing');
    expect(mapOSMNodeToControl({ crossing: 'marked' })).toBe('crossing');
  });

  it('returns null for non-control nodes', () => {
    expect(mapOSMNodeToControl({})).toBeNull();
    expect(mapOSMNodeToControl({ highway: 'residential' })).toBeNull();
    expect(mapOSMNodeToControl({ highway: 'crossing' })).toBeNull();
    expect(mapOSMNodeToControl({ crossing: 'uncontrolled' })).toBeNull();
    expect(mapOSMNodeToControl({ crossing: 'no' })).toBeNull();
    expect(mapOSMNodeToControl({ crossing: 'none' })).toBeNull();
  });
});

describe('getEffectiveSignSpeedType', () => {
  it('respects existing speedType if provided', () => {
    const cfg = {
      signId: InfrastructureType.SHARED_PATH,
      name: 'Test',
      description: 'Test',
      iconCode: '',
      baseSpeedKmh: 15,
      speedType: 'slow' as const,
      flatPenaltySeconds: 0,
    };
    expect(getEffectiveSignSpeedType(cfg)).toBe('slow');
  });

  it('maps SEGREGATED_PATH, BICYCLE_STREET, LIVING_STREET to relative', () => {
    const base = {
      name: '',
      description: '',
      iconCode: '',
      baseSpeedKmh: 15,
      flatPenaltySeconds: 0,
    };
    expect(getEffectiveSignSpeedType({ ...base, signId: InfrastructureType.SEGREGATED_PATH })).toBe(
      'relative',
    );
    expect(getEffectiveSignSpeedType({ ...base, signId: InfrastructureType.BICYCLE_STREET })).toBe(
      'relative',
    );
    expect(getEffectiveSignSpeedType({ ...base, signId: InfrastructureType.LIVING_STREET })).toBe(
      'relative',
    );
  });

  it('maps PEDESTRIAN_ZONE, SIDEWALK to dismount', () => {
    const base = {
      name: '',
      description: '',
      iconCode: '',
      baseSpeedKmh: 15,
      flatPenaltySeconds: 0,
    };
    expect(getEffectiveSignSpeedType({ ...base, signId: InfrastructureType.PEDESTRIAN_ZONE })).toBe(
      'dismount',
    );
    expect(getEffectiveSignSpeedType({ ...base, signId: InfrastructureType.SIDEWALK })).toBe(
      'dismount',
    );
  });

  it('defaults to custom for other signs', () => {
    const base = {
      name: '',
      description: '',
      iconCode: '',
      baseSpeedKmh: 15,
      flatPenaltySeconds: 0,
    };
    expect(getEffectiveSignSpeedType({ ...base, signId: InfrastructureType.SHARED_PATH })).toBe(
      'custom',
    );
  });
});

describe('getEffectiveRoadSpeedType', () => {
  it('respects existing speedType if provided', () => {
    const cfg = {
      roadId: RoadType.PRIMARY,
      name: 'Test',
      baseSpeedKmh: 30,
      speedType: 'slow' as const,
      flatPenaltySeconds: 0,
    };
    expect(getEffectiveRoadSpeedType(cfg)).toBe('slow');
  });

  it('defaults to custom', () => {
    const cfg = {
      roadId: RoadType.PRIMARY,
      name: 'Test',
      baseSpeedKmh: 30,
      flatPenaltySeconds: 0,
    };
    expect(getEffectiveRoadSpeedType(cfg)).toBe('custom');
  });
});

describe('hasCycleway', () => {
  it('identifies standard cycleway values', () => {
    expect(hasCycleway({ cycleway: 'yes' })).toBe(true);
    expect(hasCycleway({ cycleway: 'lane' })).toBe(true);
    expect(hasCycleway({ 'cycleway:left': 'track' })).toBe(true);
  });

  it('correctly handles negative values like no, none, separate', () => {
    expect(hasCycleway({ cycleway: 'no' })).toBe(false);
    expect(hasCycleway({ cycleway: 'none' })).toBe(false);
    expect(hasCycleway({ cycleway: 'separate' })).toBe(false);
    expect(hasCycleway({ 'cycleway:both': 'no' })).toBe(false);
  });

  it('correctly recognizes sidepath as a cycleway (not negative)', () => {
    expect(hasCycleway({ cycleway: 'sidepath' })).toBe(true);
    expect(hasCycleway({ 'cycleway:right': 'sidepath' })).toBe(true);
  });

  it('returns false for empty tags', () => {
    expect(hasCycleway({})).toBe(false);
  });
});

describe('getSurfaceType', () => {
  it('correctly classifies paved surfaces', () => {
    expect(getSurfaceType({ surface: 'asphalt' })).toBe('paved');
    expect(getSurfaceType({ surface: 'concrete' })).toBe('paved');
    expect(getSurfaceType({ surface: 'paving_stones' })).toBe('paved');
  });

  it('correctly classifies gravel and unpaved surfaces', () => {
    expect(getSurfaceType({ surface: 'gravel' })).toBe('gravel');
    expect(getSurfaceType({ surface: 'unpaved' })).toBe('gravel');
    expect(getSurfaceType({ surface: 'compacted' })).toBe('gravel');
  });

  it('correctly classifies cobblestone surfaces', () => {
    expect(getSurfaceType({ surface: 'cobblestone' })).toBe('cobblestone');
    expect(getSurfaceType({ surface: 'cobblestone:flattened' })).toBe('cobblestone');
  });

  it('defaults to gravel for track highway without surface tag', () => {
    expect(getSurfaceType({ highway: 'track' })).toBe('gravel');
  });

  it('defaults to paved for other highway types without surface tag', () => {
    expect(getSurfaceType({ highway: 'residential' })).toBe('paved');
    expect(getSurfaceType({})).toBe('paved');
  });
});
