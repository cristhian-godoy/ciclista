# Plan: Architecture Cleanup and Core Concepts Solidification

## 🎯 Objective

A comprehensive architectural overhaul to resolve monolithic domain coupling, clarify terminology, optimize performance, and untangle circular dependencies in shared utilities. This plan separates the monolithic router into strict, single-responsibility domains (`Config`, `Rules`, `Router`, `Strategies`, `Inspector`), completely eliminating naming collisions, extracting common math functions to dependency-free locations, and shifting heavy diagnostic logic out of the core pathfinding worker into on-demand client-side evaluators.

## 🗺️ Milestones

### Milestone 1: Establish the Configuration Domain (`core/config`)

_Focus: Extract user-facing configurations and overrides out of the `storage` and `router` domains, centralizing the single source of truth for user profiles and defaults._

- [ ] **Task 1: Create `core/config/types.ts`**
  - _Details_: Move `LocalOverrides`, `BikeProfileId`, `BikeConfig` out of `src/core/storage/types.ts`.
  - _Details_: Move `RulesConfiguration`, `SignRuleConfig`, `RoadRuleConfig`, `NodeDelayConfig`, `TurnRuleConfig` out of `src/core/router/types.ts`.
- [ ] **Task 2: Centralize Configuration Defaults**
  - _Details_: Extract `DEFAULT_RULES_CONFIG` from `rules.ts` and move it to a new file `core/config/defaults.ts` co-located with the types it instantiates, preventing UI layers from digging into OSM mapping logic to get defaults.
- [ ] **Task 3: Refactor Storage Adapters**
  - _Details_: Update `IStorageProvider` in `storage/types.ts` to consume the configurations from `core/config/types.ts`. `core/storage` should now be strictly an infrastructure adapter.
- [ ] **Task 4: Establish Barrel Exports**
  - _Details_: Create `core/config/index.ts` to expose the public API of the config domain (types, defaults), shielding consumers from internal file structures.

### Milestone 2: Establish the Rules & Impact Domain (`core/rules`)

_Focus: Centralize the translation of OpenStreetMap tags into logical infrastructure types, evaluation of user configurations into concrete numerical routing impacts, and routing business logic rules._

- [ ] **Task 1: Define `core/rules/types.ts`**
  - _Details_: Move `InfrastructureType`, `RoadType`, `ComfortLevel`, `SemanticTurnType`, and `ResolvedEdgeImpact` from `core/router/types.ts`.
- [ ] **Task 2: Create `osm-mapper.ts`**
  - _Details_: Move the contents of `src/core/router/rules.ts` here (excluding defaults).
- [ ] **Task 3: Create `impact-resolver.ts` & `bike-impacts.ts`**
  - _Details_: Move `src/core/router/rules-impacts.ts` to `core/rules/impact-resolver.ts`.
  - _Details_: Relocate the orphaned `bike.ts` from `core/router/` to `core/rules/bike-impacts.ts` (or merge into `impact-resolver.ts`), updating its imports to consume `BikeConfig` from `core/config/types.ts`.
- [ ] **Task 4: Untangle Circular Domain Logic in `geometry.ts`**
  - _Details_: Move `calculateTurnPenalty` and `getTurnDetails` out of `core/common/geometry.ts` and into `core/rules/turn-evaluator.ts`. These functions encode routing-specific business logic dependent on `TurnRuleConfig` and do not belong in a generic common math utilities file.
- [ ] **Task 5: Establish Barrel Exports**
  - _Details_: Create `core/rules/index.ts` to expose the public API (`mapOSMToSignAndRoad`, `mapOSMNodeToControl`, etc.), ensuring all cross-domain imports (like those from graph and UI layers) remain stable.

### Milestone 3: Refine the Core Router & Common Domains (`core/router` & `core/common`)

_Focus: Clean the pure pathfinder and extract stray shared utilities into their proper dependency-free locations._

- [ ] **Task 1: Clean `core/router/types.ts` & Document Dependencies**
  - _Details_: Retain only `IRouter`, `CostFunction`, and `RouteResult`. Explicitly structure imports to establish the architectural dependency direction: `config <- router -> graph`.
- [ ] **Task 2: Fix `haversineDistance` Module Placement**
  - _Details_: Extract `haversineDistance` from the graph layer (`core/graph/parser.ts`) and move it to `core/common/geo.ts` (or `geometry.ts`). Update all imports across `geo.ts`, `router.ts`, and `engine.ts` to pull from the pure common math module.
- [ ] **Task 3: Decouple Statistics from Dijkstra**
  - _Details_: Extract the `buildRouteStatistics` function from `router.ts` into a standalone utility `src/core/router/statistics.ts`.
- [ ] **Task 4: Establish Edge Metrics Module**
  - _Details_: After strategies are extracted (Milestone 4), rename the remainder of `cost.ts` (which contains `calculateDisplayCost`, `getDefaultNodeDelay`, etc.) to `core/router/edge-metrics.ts`. This module will serve as the generic physical edge cost evaluator used by both routing strategies and the inspector evaluator.

### Milestone 4: Formalize Routing Strategies

_Focus: Extract the specific cost function implementations from the general router flow into an explicit strategies module._

- [ ] **Task 1: Create `core/router/strategies.ts`**
  - _Details_: Move `standardCost`, `avoidStoppingCost`, and `avoidBusyRoadsCost` from `src/core/router/cost.ts` into this new file, utilizing utilities from the newly formed `edge-metrics.ts`.
- [ ] **Task 2: Standardize Strategy Invocation**
  - _Details_: Refactor `router.worker.ts` to iterate over an array of defined strategies.

### Milestone 5: Resolving Global vs Local Naming Collisions

_Focus: Eradicate the confusing overlapping terminology between global alternative paths and local intersection branches._

- [ ] **Task 1: Rename Local Alternatives**
  - _Details_: Rename `AlternativeEdgeEvaluation` to `InspectorBranchEvaluation`. Move to `core/inspector/types.ts`.
- [ ] **Task 2: Rename Global Alternatives**
  - _Details_: Rename `RouteAlternative` to `StrategyRouteVariant` across the codebase. Rename `RouteAlternativesLayer.tsx` to `RouteVariantsLayer.tsx`.

### Milestone 6: Extracting On-Demand Inspector Evaluator (`core/inspector`)

_Focus: Remove inspector-specific branch evaluation logic from the router to improve web worker performance._

- [ ] **Task 1: Strip `alternativeEvaluations` from `RouteResult`**
  - _Details_: Remove `alternativeEvaluations` from `RouteResult`. Delete the exhaustive branch evaluation loop inside `buildRouteStatistics`.
- [ ] **Task 2: Create `core/inspector/evaluator.ts`**
  - _Details_: Port the `evaluateEdge` logic to a new `evaluateIntersectionBranches(nodeId, routeResult, graph, overrides)` function.
- [ ] **Task 3: Create `evaluator.test.ts`**
  - _Details_: Add a new test suite verifying that the on-demand evaluator accurately calculates delays, remaining distances, and branch penalties.

### Milestone 7: Hook, UI, and Mapper Decoupling

_Focus: Ensure the UI correctly computes debugging data on-the-fly and synchronizes it across components via a single source of truth, utilizing barrel exports._

- [ ] **Task 1: Create `useIntersectionBranches` and Hoist State**
  - _Details_: Create the `useIntersectionBranches` hook. Hoist its invocation to `MapView.tsx` (or `MapProvider`) and expose its result as `inspectorBranches: InspectorBranchEvaluation[]` in `MapContextType`.
- [ ] **Task 2: Update `InspectorLayer.tsx` and Intersection Node Logic**
  - _Details_: Refactor `InspectorLayer.tsx` to consume `inspectorBranches` from `MapContext` instead of the stale `RouteResult`. Optimize intersection node rendering dynamically by scanning `graph.nodes.get(nodeId)?.edges` to identify diverging branches, avoiding heavy evaluation sweeps.
- [ ] **Task 3: Update `InspectorPanel.tsx`, `StreetGraphLayer.tsx`, & `geojson.ts`**
  - _Details_: Modify `InspectorPanel` to consume `inspectorBranches` from Context. Update `StreetGraphLayer.tsx` and `geojson.ts` to import `mapOSMNodeToControl` from the new `core/rules/` barrel export.
- [ ] **Task 4: Update Mapper & Test Suites**
  - _Details_: Modify `mapRouteToInspectorGeoJSON` in `src/core/inspector/mapper.ts` to accept an explicit `branches: InspectorBranchEvaluation[]` parameter. Update `mapper.test.ts` to mock and pass these evaluations directly.

### Milestone 8: Worker Boundaries & Serialization

_Focus: Define strict contracts for web worker messages to prevent type mismatches and optimize serialization._

- [ ] **Task 1: Define Explicit Serialization Interfaces**
  - _Details_: Define `WorkerRoutingRequest` and `WorkerRoutingResponse` in `core/router/types.ts`.
- [ ] **Task 2: Refactor Worker Payload**
  - _Details_: Implement the strict interfaces in `router.worker.ts`, ensuring it posts back clean `StrategyRouteVariant[]` without any inspector branch evaluations, drastically reducing payload size. Update `router.test.ts` and `cost.test.ts` accordingly.

## 📝 Notes & Open Questions

- **Dependency Flow**: The architecture will strictly enforce the dependency hierarchy: `Common` -> (none), `Graph` -> `Common`, `Config` -> `Common`, `Rules` -> `Config`, `Router` -> `Graph` + `Rules` + `Config`.
- **Architectural Clarity**: The domains are now rigorously separated, public APIs are explicitly defined through barrel exports, circular math dependencies are resolved, and the inspector calculations are executed lazily on the main thread instead of eagerly in the pathfinding worker.
