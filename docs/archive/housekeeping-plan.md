# Plan: Codebase Housekeeping & De-Slopping

## 🎯 Objective

Clean up remaining "AI slop" from the codebase by decoupling infrastructure logic from business logic, and refining documentation standards to be more precise and less noisy.

## 🗺️ Milestones

### Milestone 1: Infrastructure Decoupling

_Focus: Move heavy technical implementations out of the core domain logic folders._

- [x] **Extract CacheStorage Logic**:
  - _Details_: Move the raw `CacheStorage`, `evictOldCacheEntries`, and SWR logic out of `src/core/api/overpass.ts` and into a dedicated `src/core/infrastructure/` or `src/core/storage/` module. `overpass.ts` should only be responsible for the Overpass API endpoint structure and parameters, not browser storage APIs.
- [x] **Extract Native DOM Events**:
  - _Details_: (Already completed!) Moved the custom middle-mouse Blender map controls out of `useMapInstance.ts` into a dedicated `useCustomMapControls.ts` hook.

### Milestone 2: Documentation & Linting Polish

_Focus: Eliminate flowery "AI-speak" and optimize linting constraints._

- [x] **Refine ESLint JSDoc Rules**:
  - _Details_: Review the secondary JSDoc rule that forbids empty JSDocs. Ensure that we aren't forcing the AI to generate meaningless filler comments just to satisfy the linter for internal functions.
- [x] **Audit Existing Comments**:
  - _Details_: Do a sweep of the codebase (like `.info` files and component headers) to remove overly dramatic terminology ("tailored orchestrator", "cyberpunk dark hues") and replace it with objective, technical descriptions as mandated by the new `.agents/rules`.
