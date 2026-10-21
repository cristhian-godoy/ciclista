import type React from 'react';

/**
 * Common SVG properties supported by all zero-overhead Ciclista icon primitives.
 */
export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /** Dimension in pixels or CSS units. Defaults to 24. */
  size?: number | string;
  /** Stroke color token or CSS string. Defaults to currentColor. */
  color?: string;
  /** Stroke strokeWidth in pixels. Defaults to 2. */
  strokeWidth?: number | string;
  /** Optional class name appended to SVG element. */
  className?: string;
}

/**
 * Functional component type for SVG icon primitives with forwarded SVG element ref.
 */
export type LucideIcon = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;

/**
 * Tuple representation of a child SVG element definition [tag, attributes].
 */
export type IconNodeChild = [string, Record<string, string | number>];

/**
 * Union of supported icon identifier strings in PascalCase, lowercase, or kebab-case.
 */
export type IconName = string;

/**
 * Properties for the dynamic generic Icon component.
 */
export interface GenericIconProps extends IconProps {
  /** Unique icon name identifier */
  name: IconName;
}
