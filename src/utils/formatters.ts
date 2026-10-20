import {
  Briefcase,
  GraduationCap,
  Home,
  MapPin,
  Octagon,
  ShoppingBag,
  Stethoscope,
  Train,
  Trees,
  Zap,
} from 'lucide-react';
import React from 'react';

import type { LandmarkCategory } from '../core/landmarks/types';

/**
 * Options for customizing routing strategy badge labels.
 */
export interface StrategyLabelOptions {
  /**
   * Lucide icon size in pixels. Defaults to 14.
   */
  iconSize?: number;
  /**
   * Whether to display compact label text (e.g. for comparison table columns).
   * Defaults to false.
   */
  compact?: boolean;
}

/**
 * Formats a metric distance in meters into a human-readable metric string (meters or kilometers).
 *
 * @param meters - Raw distance in meters.
 * @param precision - Decimal digits to preserve when formatting kilometers. Defaults to 2.
 * @returns Formatted distance string (e.g. '450 m' or '1.25 km').
 */
export function formatDistance(meters: number, precision = 2): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(precision)} km`;
}

/**
 * Formats a duration in seconds into hours, minutes, and seconds.
 * Omits hours when duration is under one hour, and omits minutes when duration is under one minute.
 *
 * @param seconds - Total duration in seconds.
 * @returns Formatted duration string (e.g. '1h 1m 5s', '2m 30s', or '45s').
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

/**
 * Formats a duration strictly into minute and second segments (`{m}m {s}s`).
 *
 * @param seconds - Total duration in seconds.
 * @returns Formatted time string (e.g. '2m 30s' or '0m 45s').
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/**
 * Renders a standard labeled badge with icon corresponding to the routing strategy.
 *
 * @param label - Strategy identifier ('standard', 'avoid-stops', 'quiet-streets').
 * @param options - Configuration options for icon size and compact text.
 * @returns React node representing strategy label badge.
 */
export function getStrategyLabel(
  label: string,
  options: StrategyLabelOptions = {},
): React.ReactNode {
  const { iconSize = 14, compact = false } = options;

  switch (label) {
    case 'standard':
      return React.createElement(
        'span',
        { className: 'strategy-label-badge' },
        React.createElement(Zap, { size: iconSize, 'aria-label': 'Speed Icon' }),
        compact ? ' Speed' : ' Speed',
      );
    case 'avoid-stops':
      return React.createElement(
        'span',
        { className: 'strategy-label-badge' },
        React.createElement(Octagon, {
          size: iconSize,
          'aria-label': compact ? 'Stops Icon' : 'Avoid Stops Icon',
        }),
        compact ? ' Stops' : ' Avoid Stops',
      );
    case 'quiet-streets':
      return React.createElement(
        'span',
        { className: 'strategy-label-badge' },
        React.createElement(Trees, {
          size: iconSize,
          'aria-label': compact ? 'Quiet Icon' : 'Quiet Paths Icon',
        }),
        compact ? ' Quiet' : ' Quiet Paths',
      );
    default:
      return label;
  }
}

/**
 * Returns a corresponding icon component for each place or landmark category.
 *
 * @param category - The target category identifier.
 * @param size - Icon size in pixels. Defaults to 16.
 * @returns React icon node.
 */
export function getCategoryIcon(category: LandmarkCategory | string, size = 16): React.ReactNode {
  switch (category) {
    case 'home':
      return React.createElement(Home, { size });
    case 'work':
      return React.createElement(Briefcase, { size });
    case 'doctor':
      return React.createElement(Stethoscope, { size });
    case 'school':
      return React.createElement(GraduationCap, { size });
    case 'shop':
      return React.createElement(ShoppingBag, { size });
    case 'transit':
      return React.createElement(Train, { size });
    case 'leisure':
      return React.createElement(Trees, { size });
    case 'other':
    default:
      return React.createElement(MapPin, { size });
  }
}
