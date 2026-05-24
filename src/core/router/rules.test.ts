import { describe, expect, it } from 'vitest';

import { mapOSMNodeToControl, mapOSMToSignAndRoad } from './rules';
import { GermanSign, RoadType } from './types';

describe('mapOSMToSignAndRoad', () => {
  // ── Fahrradstraße ─────────────────────────────────────────────────────────
  it('maps bicycle_road=yes to VZ_244_1', () => {
    const r = mapOSMToSignAndRoad('residential', { bicycle_road: 'yes' });
    expect(r.sign).toBe(GermanSign.VZ_244_1);
    expect(r.bicycleFrei).toBe(true);
  });

  it('maps highway=cycleway to VZ_241 (segregated path)', () => {
    const r = mapOSMToSignAndRoad('cycleway', {});
    expect(r.sign).toBe(GermanSign.VZ_241);
    expect(r.road).toBe(RoadType.PATH_DEFAULT);
    expect(r.bicycleFrei).toBe(true);
  });

  // ── Living street ─────────────────────────────────────────────────────────
  it('maps living_street to VZ_325_1', () => {
    const r = mapOSMToSignAndRoad('living_street', {});
    expect(r.sign).toBe(GermanSign.VZ_325_1);
    expect(r.road).toBe(RoadType.RESIDENTIAL);
    expect(r.bicycleFrei).toBe(true);
  });

  // ── Shared / segregated path ──────────────────────────────────────────────
  it('maps path with bicycle=designated + foot=designated + segregated=yes to VZ_241', () => {
    const r = mapOSMToSignAndRoad('path', {
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'yes',
    });
    expect(r.sign).toBe(GermanSign.VZ_241);
    expect(r.bicycleFrei).toBe(true);
  });

  it('maps path with bicycle=designated + foot=designated (no segregated) to VZ_240', () => {
    const r = mapOSMToSignAndRoad('path', {
      bicycle: 'designated',
      foot: 'designated',
    });
    expect(r.sign).toBe(GermanSign.VZ_240);
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
  it('maps pedestrian without bicycle tag to VZ_242_1 with bicycleFrei=false', () => {
    const r = mapOSMToSignAndRoad('pedestrian', {});
    expect(r.sign).toBe(GermanSign.VZ_242_1);
    expect(r.bicycleFrei).toBe(false);
  });

  it('maps pedestrian with bicycle=yes to VZ_242_1 with bicycleFrei=true (Fahrräder frei)', () => {
    const r = mapOSMToSignAndRoad('pedestrian', { bicycle: 'yes' });
    expect(r.sign).toBe(GermanSign.VZ_242_1);
    expect(r.bicycleFrei).toBe(true);
  });

  // ── Footway / sidewalk ────────────────────────────────────────────────────
  it('maps footway without bicycle tag to VZ_239 with bicycleFrei=false', () => {
    const r = mapOSMToSignAndRoad('footway', {});
    expect(r.sign).toBe(GermanSign.VZ_239);
    expect(r.bicycleFrei).toBe(false);
  });

  it('maps footway with bicycle=designated to VZ_239 with bicycleFrei=true', () => {
    const r = mapOSMToSignAndRoad('footway', { bicycle: 'designated' });
    expect(r.sign).toBe(GermanSign.VZ_239);
    expect(r.bicycleFrei).toBe(true);
  });

  it('maps footway with both bicycle and foot designated to VZ_240/VZ_241', () => {
    const shared = mapOSMToSignAndRoad('footway', { bicycle: 'designated', foot: 'designated' });
    expect(shared.sign).toBe(GermanSign.VZ_240);

    const segregated = mapOSMToSignAndRoad('footway', {
      bicycle: 'designated',
      foot: 'designated',
      segregated: 'yes',
    });
    expect(segregated.sign).toBe(GermanSign.VZ_241);
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
