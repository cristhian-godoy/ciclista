import { describe, expect, it, vi } from 'vitest';

import { coordToChunkId, getChunkBBox, getChunksInBBox, mergeChunksToBBox } from './geo';
import { logger } from './logger';

vi.mock('./logger', () => ({
  logger: {
    warn: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('geo chunking utilities', () => {
  it('coordToChunkId should map coordinate to indices', () => {
    // Lat: 48.137, Lng: 11.575
    // With Size: 0.01
    // 48.137 / 0.01 = 4813.7 -> Floor: 4813
    // 11.575 / 0.01 = 1157.5 -> Floor: 1157
    expect(coordToChunkId(48.137, 11.575)).toBe('4813,1157');
    expect(coordToChunkId(-48.137, -11.575)).toBe('-4814,-1158');
  });

  it('getChunkBBox should return correct boundaries', () => {
    const bbox = getChunkBBox('4813,1157');
    expect(bbox).toEqual([48.13, 11.57, 48.14, 11.58]);
  });

  it('getChunksInBBox should return intersecting chunks', () => {
    const bbox: [number, number, number, number] = [48.132, 11.572, 48.145, 11.585];
    // Start Lat Idx: Floor(48.132 / 0.01) = 4813. End Lat Idx: Floor(48.145 / 0.01) = 4814.
    // Start Lng Idx: Floor(11.572 / 0.01) = 1157. End Lng Idx: Floor(11.585 / 0.01) = 1158.
    // Chunks: 4813,1157; 4813,1158; 4814,1157; 4814,1158
    const chunks = getChunksInBBox(bbox);
    expect(chunks).toHaveLength(4);
    expect(chunks).toContain('4813,1157');
    expect(chunks).toContain('4813,1158');
    expect(chunks).toContain('4814,1157');
    expect(chunks).toContain('4814,1158');
  });

  it('getChunksInBBox should abort and return empty array if safety limit exceeded', () => {
    const spy = vi.spyOn(logger, 'warn');
    const bbox: [number, number, number, number] = [48.0, 11.0, 49.0, 12.0]; // 100 * 100 = 10000 chunks
    const chunks = getChunksInBBox(bbox);
    expect(chunks).toEqual([]);
    expect(spy).toHaveBeenCalled();
  });

  it('mergeChunksToBBox should calculate containing envelope', () => {
    const chunks = ['4813,1157', '4814,1158'];
    // 4813,1157 -> [48.13, 11.57, 48.14, 11.58]
    // 4814,1158 -> [48.14, 11.58, 48.15, 11.59]
    // Envelope -> [48.13, 11.57, 48.15, 11.59]
    const merged = mergeChunksToBBox(chunks);
    expect(merged).toEqual([48.13, 11.57, 48.15, 11.59]);
  });

  it('mergeChunksToBBox with empty input should return empty bounds', () => {
    expect(mergeChunksToBBox([])).toEqual([0, 0, 0, 0]);
  });
});
