/**
 * Centralized theme colors and palette mappings for path rendering.
 */

export const STRATEGY_COLORS = {
  standard: '#6366f1',
  'avoid-stops': '#f43f5e',
  'quiet-streets': '#14b8a6',
} as const;

export const INACTIVE_STRATEGY_COLORS = {
  standard: '#a5b4fc', // muted indigo
  'avoid-stops': '#fda4af', // muted rose
  'quiet-streets': '#99f6e4', // muted teal
} as const;

export const PALETTES = {
  active: STRATEGY_COLORS,
  inactive: INACTIVE_STRATEGY_COLORS,
  alternative: '#f97316', // orange (for local alternative branches)
  semantic: {
    safe: '#10b981', // Green (segregated_path, bicycle_street)
    penalty: '#8b5cf6', // Purple (pedestrian_zone, sidewalk)
    acceptable: '#3b82f6', // Blue (shared_path, living_street, default)
    danger: '#ef4444', // Red (primary, secondary road classes)
  },
} as const;

/**
 * Maps matched infrastructure or road types to standard color codes.
 */
export function getColorForEdge(matchedSign: string | null, matchedRoad: string): string {
  if (matchedSign === 'segregated_path' || matchedSign === 'bicycle_street') {
    return PALETTES.semantic.safe;
  }
  if (matchedSign === 'pedestrian_zone' || matchedSign === 'sidewalk') {
    return PALETTES.semantic.penalty;
  }
  if (matchedSign === 'shared_path' || matchedSign === 'living_street') {
    return PALETTES.semantic.acceptable;
  }
  if (matchedRoad === 'primary' || matchedRoad === 'secondary') {
    return PALETTES.semantic.danger;
  }
  return PALETTES.semantic.acceptable;
}
