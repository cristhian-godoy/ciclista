# Code Cleanup and Refactoring Plan

This document outlines the bite-sized tasks required to improve the code quality, maintainability, and architecture of the repository based on the recent codebase scrutiny.

## 1. Resolve DRY Violations in `router.ts`

- **Goal**: Eliminate the massive duplication between `findRoute` and `findRouteNodeFallback` in `DijkstraRouter`.
- **Tasks**:
  - [x] Extract the core Dijkstra search loop into a shared private helper method (`runDijkstra`).
  - [x] Extract the path reconstruction and statistics calculation into a shared helper method (`buildRouteStatistics`).
  - [x] Refactor `findRoute` and `findRouteNodeFallback` to call these new helper methods.

## 2. Break Down the Monolithic `App.tsx`

- **Goal**: Separate concerns and reduce the size of `App.tsx` (~500 lines) by extracting logic into custom hooks and services.
- **Tasks**:
  - [x] **API Service**: Extract Overpass API fetching, caching (`fetchWithCacheAndFallback`), and mirrors list into `src/core/api/overpass.ts` or a custom hook `useOSMData`.
  - [x] **Geospatial Utilities**: Move bounding box helpers (`calculateBoundingBox`, `isInsideLoadedArea`, `snapCoordinateToEdge`) to a new utility file `src/core/common/geo.ts`.
  - [x] **State Management**: Extract the complex rules config merging and local storage syncing into a custom hook (e.g., `useOverrides.ts`).

## 3. Modularize `router.ts` Utilities

- **Goal**: Keep `router.ts` focused purely on routing algorithms by extracting unrelated utilities.
- **Tasks**:
  - [ ] Move the `MinHeap` class to a shared utility file `src/core/common/MinHeap.ts`.
  - [ ] Move geometry and projection functions (`findNearestNode`, `projectPointOnSegment`, `findNearestEdge`, `getProjectionT`, `calculateTurnPenalty`) into `src/core/common/geometry.ts`.

## 4. Centralize Magic Numbers and Configurations

- **Goal**: Eliminate hardcoded values scattered across the codebase to make tweaking configurations easier.
- **Tasks**:
  - [ ] Create `src/core/common/constants.ts` (or `config.ts`).
  - [ ] Move API constants like `OVERPASS_MIRRORS`, `CACHE_NAME`, and query timeouts.
  - [ ] Move bounding box padding margins (`0.015`, `0.02`), maximum limits, and default city coordinates to constants.
  - [ ] Move routing constants (e.g., the 30s U-turn penalty, 3 meters snapping distance).

## 5. Polish and Performance Optimization

- **Goal**: Finalize code cleanliness for production.
- **Tasks**:
  - [ ] Clean up leftover development logs (`console.log` and `console.warn`) in `App.tsx` and `router.ts`, or replace them with a proper environment-aware logger.
  - [ ] Optimize `mergeGraphs` in `App.tsx` to reduce memory allocations/cloning when merging large graph areas.
