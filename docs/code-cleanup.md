# Code Cleanup and Refactoring Plan

This document outlines a phased approach to improving the repository's code quality, modularity, and testing, keeping the system clean and maintainable.

## Phase 1: Automation & Linting Standardization

_Goal: Ensure all new code adheres to a consistent format and passes lint checks before entering the commit history._

- [x] Install Prettier and its ESLint integrations (`prettier`, `eslint-config-prettier`, `eslint-plugin-prettier`).
- [x] Create a `.prettierrc` configuration file with project-specific formatting rules.
- [x] Install `husky` and `lint-staged` as development dependencies.
- [x] Initialize Husky and configure the `pre-commit` hook.
- [x] Configure `lint-staged` in `package.json` to run Prettier and ESLint on staged files.
- [x] Re-enable the `'react-hooks/set-state-in-effect'` rule in `eslint.config.js` and fix any resulting violations.

## Phase 2: Type Organization

_Goal: Prevent `types.ts` from becoming a monolithic bottleneck by co-locating types with their respective domains._

- [x] Create `src/core/router/types.ts` and move router-specific interfaces from `src/core/types.ts`.
- [x] Create `src/core/graph/types.ts` and move graph/parsing-specific interfaces.
- [x] Create `src/core/storage/types.ts` and move storage-specific interfaces.
- [x] Update all import statements across the codebase to point to the new domain-specific type files.
- [x] Remove the old `src/core/types.ts` file if it is empty, or rename it to `src/core/common/types.ts` for shared interfaces.

## Phase 3: UI Component De-structuring (Part 1 - App & Sidebar)

_Goal: Break down the largest React components to follow the Single Responsibility Principle._

- [x] Analyze `src/App.tsx` and extract layout/scaffolding into smaller wrapper components if necessary.
- [x] Break down `src/components/RulesConfigPanel.tsx` into smaller chunks (e.g., individual rule toggle components, slider sections).
- [x] Break down `src/components/Sidebar.tsx` by extracting the routing input fields and the stats panel into separate files.

## Phase 4: UI Component De-structuring (Part 2 - MapView)

_Goal: Refactor the heavily-loaded `MapView.tsx` into manageable, isolated layers._

- [ ] Extract MapLibre initialization and core map state into a custom hook (e.g., `useMapInstance.ts`).
- [ ] Extract layer rendering logic (e.g., drawing routes, drawing nodes) into separate components or hooks (e.g., `RouteLayer.tsx`, `NodeLayer.tsx`).
- [ ] Extract map controls and popup logic into their own dedicated components (e.g., `MapPopup.tsx`).
- [ ] Refactor `MapView.tsx` to act purely as an orchestrator for these smaller sub-components.

## Phase 5: UI Testing Integration

_Goal: Introduce testing to the React UI layer to prevent visual and interaction regressions._

- [ ] Install `@testing-library/react` and `@testing-library/jest-dom` (or equivalent for Vitest).
- [ ] Configure Vitest for DOM testing (e.g., adding `jsdom` or `happy-dom` environment).
- [ ] Write unit tests for small, isolated UI components (e.g., the extracted rule toggle components).
- [ ] Write integration tests for the `Sidebar` and `RulesConfigPanel` to ensure they handle state changes correctly.
- [ ] Set up tests for the map state interactions (mocking MapLibre where necessary).
