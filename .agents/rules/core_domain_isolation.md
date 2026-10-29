# Rule: Core Domain Isolation and Layering

## Activation
- **Always On**

## Guidelines

1. **Framework Decoupling**:
   - Code in `src/core/` must remain pure TypeScript. Do not import React, MapLibre, or browser DOM globals (`window`, `document`) into `src/core/`. All platform interactions must be injected or passed as arguments.

2. **Web Worker Concurrency**:
   - CPU-intensive tasks (such as Dijkstra pathfinding and raw OSM data parsing) must execute within Web Workers (`router.worker.ts`, `parser.worker.ts`). Never run heavy graph computations synchronously on the main UI thread.

3. **Configuration Single Source of Truth**:
   - All routing algorithms, default velocities, road classifications, turn penalties, and profile schemas must reference `src/core/config/` (`defaults.ts`, `types.ts`). Do not scatter hardcoded configuration constants across components or submodules.
