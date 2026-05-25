# Documentation Improvement Plan

This plan outlines our strategy to ensure that TSDoc comments in our codebase are meaningful, concise, and effectively document contracts without cluttering the code with empty or redundant blocks just to pass linting.

## Milestone 1: Document Code Concisely

The goal of this milestone is to manually clean up and improve the existing TSDoc comments in the codebase. By temporarily enabling `jsdoc/require-description`, we identified **33 specific instances** across the project where JSDoc blocks are empty or lack descriptions.

### 1.1 UI Components & Views

Update or remove empty JSDoc blocks in the following React components:

- `src/App.tsx` (Line 12)
- `src/components/IntersectionDelaySection.tsx` (Line 108)
- `src/components/MapView.tsx` (Line 197)
- `src/components/RouteStatsPanel.tsx` (Line 25)
- `src/components/RoutingConfigPanel.tsx` (Line 16)
- `src/components/RulesConfigPanel.tsx` (Line 28)
- `src/components/RulesRows.tsx` (Lines 37, 129)
- `src/components/RulesSelectorFields.tsx` (Lines 11, 58)
- `src/components/Sidebar.tsx` (Line 30)

### 1.2 Map Components

Clean up empty JSDocs for the following map-related layers and hooks:

- `src/components/map/BBoxBoundaryLayer.tsx` (Line 6)
- `src/components/map/MapContextMenu.tsx` (Line 6)
- `src/components/map/MapLayerDock.tsx` (Line 6)
- `src/components/map/NodePopup.tsx` (Line 6)
- `src/components/map/RouteAlternativesLayer.tsx` (Line 6)
- `src/components/map/StartEndMarkers.tsx` (Line 6)
- `src/components/map/StreetGraphLayer.tsx` (Line 25)
- `src/components/map/useMapInstance.ts` (Line 16)

### 1.3 Core Modules & Hooks

Document complex algorithms and core state managers, while removing useless empty blocks:

- `src/core/common/MinHeap.ts` (Lines 7, 15, 29)
- `src/core/common/geo.ts` (Lines 7, 41, 55)
- `src/core/common/geometry.ts` (Line 106)
- `src/core/graph/parser.ts` (Line 42)
- `src/core/router/router.ts` (Line 390)
- `src/core/storage/storage.ts` (Lines 130, 163, 175, 187)
- `src/hooks/useOverrides.ts` (Line 10)

_Action:_ For each instance above, evaluate if the entity is exported/public API. If yes, write a concise TSDoc describing concepts, intentions, and contracts. If it is an internal method, simply remove the empty `/** */` block.

**Internal Methods:** Purely internal helper methods or self-explanatory utilities are intentionally not covered by our linting. Because the linter focuses exclusively on public APIs, there is no need to add fake or empty doc blocks to "pass" linting on internal methods.

## Milestone 2: Enforce Proper Docs with Linting

The goal of this milestone is to update our ESLint configuration to programmatically enforce the standards established in Milestone 1, making it impossible to pass linting with empty or low-effort doc blocks.

### 2.1 Update `eslint.config.js`

- **Enforce descriptions:** Add `'jsdoc/require-description': 'error'` to the ESLint rules array. This ensures that every JSDoc block must contain text, preventing `/** */` abuse.
- **Strictly target exported entities:** Review the `jsdoc/require-jsdoc` rule. Keep `publicOnly: true` and ensure the rule is scoped correctly so developers aren't forced to add JSDocs to purely internal functions.
- **Escalate severity:** Change the base `'jsdoc/require-jsdoc'` severity from `'warn'` to `'error'` so that undocumented public APIs fail the CI build.
- **(Optional) Match description length:** If empty blocks persist as one-letter descriptions (e.g., `/** a */`), consider adding `'jsdoc/match-description': ['error', { matchDescription: '^.{10,}$' }]` to enforce meaningful lengths.
