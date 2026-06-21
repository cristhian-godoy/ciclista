# Plan: Interactive Inspector Mode

## 🎯 Objective

Implement an interactive inspector mode that allows users to select individual nodes along their chosen route and visualize the cost factors, rules, and alternative paths evaluated by the routing algorithm, promoting transparency in algorithmic decisions.

## 🗺️ Milestones

### Milestone 1: Core Algorithm Support (Cost Factor Breakdown Extraction)

_Focus: Expose pre-algorithm configurations and evaluated impacts for routing edges while keeping the core Dijkstra logic unchanged (Open/Closed Principle, Single Responsibility Principle)._

- [x] **Task 1: Define Evaluation Types**
  - _Details_: Create strictly typed interfaces (e.g., `AlternativeEdgeEvaluation`) in `src/core/router/types.ts` to encapsulate base speed, surface conditions, flat penalties, comfort modifiers, and matched infrastructure signs for non-selected edges.
- [x] **Task 2: Decouple Cost Evaluation Logic**
  - _Details_: Refactor `cost.ts` to expose a cohesive, stateless utility function that calculates the detailed impact breakdown for any generic edge. This ensures Separation of Concerns and avoids repeating evaluation logic (DRY).
- [x] **Task 3: Augment `RouteResult`**
  - _Details_: Modify `buildRouteStatistics` in `router.ts` to compute and attach `AlternativeEdgeEvaluation` objects for the out-edges of each traversed node. This isolates the inspector logic from the pathfinding loop, maintaining loose coupling.

### Milestone 2: State Management & Hooks

_Focus: Manage the inspector mode UI state cleanly and independently._

- [x] **Task 1: Implement `useInspectorMode` Hook**
  - _Details_: Create a custom React hook to manage `isInspectorModeActive` and `selectedNodeId` state. This centralizes state management and prevents bloating existing hooks (Single Responsibility Principle, Interface Segregation).

### Milestone 3: UI Components & Map Visualization

_Focus: Build loosely coupled, reusable components for rendering inspector data on the map and in the UI._

- [x] **Task 2: Interactive Node Map Layer**
  - _Details_: Implement a MapLibre layer to render clickable nodes along the active route when inspector mode is toggled on.
- [x] **Task 3: Alternative Paths Visualization**
  - _Details_: Render divergent map line layers for the alternative paths originating from the `selectedNodeId`, visually differentiating them from the main route.
- [x] **Task 4: Inspector Details Panel Component**
  - _Details_: Build a standalone React component (favoring Composition over Inheritance) that displays a side-by-side comparison of the chosen edge versus the alternatives, detailing the exact rule impacts (surface, speed, signs, delays) derived from the evaluation utility.

## 📝 Notes & Open Questions

- **Performance**: Will evaluating all alternative edges within `buildRouteStatistics` cause a noticeable delay for very long routes? We should monitor this to prevent Technical Debt.
- **Visual Clutter**: How do we handle nodes with many complex alternatives (e.g., large roundabouts or complex junctions) without overwhelming the map view?
