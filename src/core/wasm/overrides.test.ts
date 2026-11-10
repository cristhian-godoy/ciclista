import { describe, expect, it } from 'vitest';

import type { LocalOverrides } from '../config';
import { serializeOverridesForWasm } from './overrides';

describe('serializeOverridesForWasm', () => {
  it('returns undefined when overrides is not provided', () => {
    expect(serializeOverridesForWasm(undefined)).toBeUndefined();
  });

  it('preserves maps and records without modification', () => {
    const overrides: LocalOverrides = {
      nodeDelays: new Map([['node-1', 15]]),
      nodeNotes: new Map([['node-1', 'Slow surface']]),
      nodeTurns: new Map(),
    };

    const serialized = serializeOverridesForWasm(overrides);
    expect(serialized).toBeDefined();
    expect(serialized?.nodeDelays).toBe(overrides.nodeDelays);
    expect(serialized?.nodeNotes).toBe(overrides.nodeNotes);
    expect(serialized?.nodeTurns).toBe(overrides.nodeTurns);
    expect(serialized?.blockedEdges).toBeUndefined();
  });

  it('converts blockedEdges Set into an array', () => {
    const blockedSet = new Set(['1->2', '3->4']);
    const overrides: LocalOverrides = {
      nodeDelays: new Map(),
      nodeNotes: new Map(),
      nodeTurns: new Map(),
      blockedEdges: blockedSet,
    };

    const serialized = serializeOverridesForWasm(overrides);
    expect(serialized).toBeDefined();
    expect(Array.isArray(serialized?.blockedEdges)).toBe(true);
    expect(serialized?.blockedEdges).toEqual(['1->2', '3->4']);

    // Original Set should not be mutated
    expect(blockedSet.has('1->2')).toBe(true);
    expect(blockedSet.has('3->4')).toBe(true);
  });

  it('converts arbitrary Set fields into arrays without mutating the source', () => {
    const customSet = new Set(['alpha', 'beta']);
    const overrides = {
      nodeDelays: new Map(),
      nodeNotes: new Map(),
      nodeTurns: new Map(),
      customTags: customSet,
    } as unknown as LocalOverrides;

    const serialized = serializeOverridesForWasm(overrides);
    expect(serialized).toBeDefined();
    const resultRecord = serialized as unknown as Record<string, unknown>;
    expect(Array.isArray(resultRecord.customTags)).toBe(true);
    expect(resultRecord.customTags).toEqual(['alpha', 'beta']);
  });
});
