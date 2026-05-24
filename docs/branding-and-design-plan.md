# Ciclista Branding & Design System Plan

This document outlines the strategy for standardizing the design language, cleaning up the styling architecture, and enforcing brand consistency across the Ciclista application.

## 1. Design Tokens (CSS Variables) Refactoring

Currently, the app uses generic variable names (e.g., `--bg-primary`, `--accent-primary`). To establish a strong, conflict-free design language, we will migrate to a strictly namespaced token system.

**Proposed Naming Convention:**
`--[namespace]-[category]-[property]-[variant]`

Examples:

- **Colors:**
  - `--ciclista-color-brand-main` (formerly `--accent-primary`)
  - `--ciclista-color-brand-hover`
  - `--ciclista-color-surface-base` (formerly `--bg-primary`)
  - `--ciclista-color-surface-elevated`
  - `--ciclista-color-text-primary`
- **Glassmorphism:**
  - `--ciclista-glass-bg-base`
  - `--ciclista-glass-border-base`
- **Spacing & Layout:**
  - `--ciclista-spacing-md`
  - `--ciclista-radius-md`

## 2. Eliminating Hardcoded Values

Currently, `components.css` and `layout.css` contain raw color values (e.g., `rgba(255, 255, 255, 0.05)`, `#fff`, `hsl(...)`).

**Action Item:**
Audit all CSS files and replace _every_ raw color, shadow, and sizing value with a corresponding `--ciclista-*` design token defined in `variables.css`.

## 3. Enforcing Standards with Linting (Stylelint)

To prevent future hardcoded colors and unnamed magic values, we will introduce CSS linting.

**Action Items:**

1. Install `stylelint` and `stylelint-config-standard`.
2. Install `stylelint-declaration-strict-value` to enforce that certain CSS properties (like `color`, `background-color`, `border-color`, `fill`, `stroke`, `box-shadow`) _must_ use a CSS variable instead of a raw hex/hsl/rgba value.
3. Configure `package.json` with a `lint:css` script.
4. Add the CSS linter to the `lint-staged` pre-commit hook so bad CSS can never be committed.

## 4. Reusable Component Definitions

We will formalize UI components to prevent CSS duplication and ensure consistent branding.

**Action Items:**

- **Buttons:** Define `.ciclista-btn`, `.ciclista-btn--primary`, `.ciclista-btn--secondary`, `.ciclista-btn--danger`.
- **Forms:** Define `.ciclista-input`, `.ciclista-label`, `.ciclista-slider`.
- **Cards/Panels:** Define `.ciclista-card`, `.ciclista-glass-panel`.
- **Badges:** Define `.ciclista-badge`, `.ciclista-badge--info`, `.ciclista-badge--warning`.

By moving to this standardized naming convention and enforcing it with Stylelint, the codebase will remain visually consistent and highly maintainable as the project grows.
