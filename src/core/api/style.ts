import type { StyleSpecification } from 'maplibre-gl';

import { logger } from '../common/logger';
import { fetchWithCache } from '../storage/cache';
import { addDataUsage } from '../storage/dataUsage';

/**
 * Filters out POI and non-essential symbol layers from a style specification.
 * Prevents MapLibre from requesting missing icons and reduces client-side rendering load.
 */
export function filterStylePOIs(style: StyleSpecification): StyleSpecification {
  if (!style || !Array.isArray(style.layers)) {
    return style;
  }

  const filteredLayers = style.layers.filter((layer) => {
    if (layer.type === 'symbol') {
      const id = layer.id.toLowerCase();

      const isPoi =
        id.includes('poi') ||
        id.includes('amenity') ||
        id.includes('shop') ||
        id.includes('office') ||
        id.includes('medical') ||
        id.includes('food') ||
        id.includes('restaurant') ||
        id.includes('cafe') ||
        id.includes('hotel') ||
        id.includes('tourism') ||
        id.includes('leisure') ||
        id.includes('sport') ||
        id.includes('station') ||
        id.includes('transport-sign');

      return !isPoi;
    }
    return true;
  });

  return {
    ...style,
    layers: filteredLayers,
  };
}

/**
 * Fetches and filters the stylesheet configuration from OpenFreeMap.
 * Integrates with CacheStorage for local caching and data usage logging.
 */
export async function fetchFilteredStyle(
  theme: 'bright' | 'liberty' | 'dark',
): Promise<StyleSpecification> {
  const url = `https://tiles.openfreemap.org/styles/${theme}`;
  const cacheKeyUrl = `https://openfreemap-style-cache/${theme}`;

  return fetchWithCache(cacheKeyUrl, async () => {
    logger.log(`Fetching MapLibre style from network: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch MapLibre style from ${url}: ${response.status}`);
    }

    const text = await response.text();
    try {
      const bytes = new Blob([text]).size;
      addDataUsage(bytes, false);
    } catch (e) {
      logger.warn('Failed to calculate downloaded style size:', e);
    }

    const rawStyle = JSON.parse(text) as StyleSpecification;
    return filterStylePOIs(rawStyle);
  });
}
