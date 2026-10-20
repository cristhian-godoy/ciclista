import React from 'react';

import { getCategoryIcon } from '../../utils/formatters';

/**
 * Supported strict categories for places.
 */
export type PlaceCategory = 'home' | 'work' | 'doctor' | 'school' | 'other';

/**
 * Category metadata descriptor for searchable dropdown.
 */
export interface PlaceCategoryOption {
  category: PlaceCategory;
  label: string;
  defaultName: string;
  icon: React.ReactNode;
}

/**
 * Strictly supported categories with corresponding icons and prefill names.
 */
export const PLACE_CATEGORIES: readonly PlaceCategoryOption[] = [
  { category: 'home', label: 'Home', defaultName: 'Home', icon: getCategoryIcon('home', 16) },
  { category: 'work', label: 'Work', defaultName: 'Work', icon: getCategoryIcon('work', 16) },
  {
    category: 'doctor',
    label: 'Doctor',
    defaultName: 'Doctor',
    icon: getCategoryIcon('doctor', 16),
  },
  {
    category: 'school',
    label: 'School',
    defaultName: 'School',
    icon: getCategoryIcon('school', 16),
  },
  { category: 'other', label: 'Other', defaultName: 'Other', icon: getCategoryIcon('other', 16) },
] as const;

export const CATEGORY_MAP = new Map<PlaceCategory, PlaceCategoryOption>(
  PLACE_CATEGORIES.map((opt) => [opt.category, opt]),
);
