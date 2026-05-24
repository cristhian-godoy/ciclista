# Ciclista Branding & Design System Plan

This document outlines the strategy for standardizing the design language, cleaning up the styling architecture, and enforcing brand consistency across the Ciclista application.

## Bite-size rule

**Each bite touches a minimal set of files, produces a clean build, and is independently committable.** No bite should require understanding another in-progress bite to be reviewed.

## Phase 1: Linting Setup & Tooling

- [ ] **Bite 1.1: Install Stylelint**
  - Install `stylelint`, `stylelint-config-standard`, and `stylelint-declaration-strict-value`.
  - Create a `.stylelintrc.json` configuration file.
- [ ] **Bite 1.2: Configure Strict Value Rules**
  - Configure Stylelint to enforce variables for `color`, `background-color`, `border-color`, `fill`, and `box-shadow`.
  - Add temporary exceptions (or configure warnings instead of errors initially) for legacy files so the build doesn't immediately fail.
- [ ] **Bite 1.3: Update Scripts & Hooks**
  - Add `"lint:css": "stylelint 'src/**/*.css'"` to `package.json`.
  - Add CSS linting to the `lint-staged` configuration so new violations cannot be committed.

## Phase 2: Design Tokens Definition

- [ ] **Bite 2.1: Base Color Palette Tokens**
  - Define `--ciclista-color-brand-main`, `--ciclista-color-brand-hover` (indigo/teal accents).
  - Define `--ciclista-color-surface-base`, `--ciclista-color-surface-elevated` (dark backgrounds).
  - Define `--ciclista-color-text-primary`, `--ciclista-color-text-muted`.
- [ ] **Bite 2.2: Glassmorphism & Effects**
  - Define `--ciclista-glass-bg-base`, `--ciclista-glass-bg-hover`.
  - Define `--ciclista-glass-border-base`, `--ciclista-glass-border-focus`.
  - Define shadows and glow effects (`--ciclista-shadow-sm`, `--ciclista-shadow-glow`).
- [ ] **Bite 2.3: Spacing & Geometry**
  - Define spacing tokens (`--ciclista-spacing-sm`, `--ciclista-spacing-md`).
  - Define border radiuses (`--ciclista-radius-sm`, `--ciclista-radius-round`).
- [ ] **Bite 2.4: Clean up old variable declarations**
  - Append the new tokens to `variables.css` without breaking the old ones (yet).

## Phase 3: Token Migration

- [ ] **Bite 3.1: Migrate Layout & Base Elements**
  - Replace old variables and hardcoded hex/rgba values in `src/index.css` and `src/styles/layout.css`.
- [ ] **Bite 3.2: Migrate Typography & Forms**
  - Update `h1`, `h2`, inputs, and sliders in `src/styles/components.css`.
- [ ] **Bite 3.3: Migrate Buttons & Badges**
  - Update all button states (`.btn-primary`, `.btn-secondary`) and badge classes.
- [ ] **Bite 3.4: Migrate Complex Components**
  - Update Map Context Menu, Popups, and the Rules Config Panel classes.
- [ ] **Bite 3.5: Remove Legacy Variables & Lint Overrides**
  - Delete old `--bg-primary` style variables from `variables.css`.
  - Enforce strict Stylelint rules. The codebase must now pass 100% cleanly without using magic colors.

## Phase 4: Component Standardization

- [ ] **Bite 4.1: Refactor Button Nomenclature**
  - Rename old generic classes (e.g. `.btn`) to namespace-protected classes: `.ciclista-btn`, `.ciclista-btn--primary`, `.ciclista-btn--danger`.
  - Update React components to use the new class names.
- [ ] **Bite 4.2: Standardize Cards & Panels**
  - Create and apply `.ciclista-card` and `.ciclista-glass-panel` consistently across the Sidebar and MapOverlays.
- [ ] **Bite 4.3: Standardize Forms**
  - Rename generic input classes to `.ciclista-input`, `.ciclista-label`, and `.ciclista-slider`. Update the UI to match.
