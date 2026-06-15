import type { StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { filterStylePOIs } from './style';

describe('filterStylePOIs', () => {
  it('should return the style object unmodified if it is invalid or has no layers', () => {
    const invalidStyle1 = null as unknown as StyleSpecification;
    const invalidStyle2 = {} as StyleSpecification;

    expect(filterStylePOIs(invalidStyle1)).toBeNull();
    expect(filterStylePOIs(invalidStyle2)).toEqual({});
  });

  it('should filter out symbol layers that match POI patterns but keep other layers', () => {
    const mockStyle = {
      version: 8,
      layers: [
        { id: 'background', type: 'background' },
        { id: 'roads', type: 'line' },
        { id: 'poi-park', type: 'symbol' },
        { id: 'amenity-cafe', type: 'symbol' },
        { id: 'shop-bicycle', type: 'symbol' },
        { id: 'office-admin', type: 'symbol' },
        { id: 'road-label', type: 'symbol' }, // should be kept
        { id: 'town-label', type: 'symbol' }, // should be kept
      ],
    } as unknown as StyleSpecification;

    const result = filterStylePOIs(mockStyle);

    expect(result.layers).toHaveLength(4);
    expect(result.layers.map((l) => l.id)).toEqual([
      'background',
      'roads',
      'road-label',
      'town-label',
    ]);
  });
});
