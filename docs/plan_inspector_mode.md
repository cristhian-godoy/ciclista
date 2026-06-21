# Plan: Interactive Inspector Mode

## 🎯 Objective

Enhance the existing interactive inspector mode to provide full visibility into algorithmic routing choices, enabling users to understand why specific rules (turns, signs, paths) caused a segment to be favored or penalized, and visualize full alternative paths originating from intersection nodes.

## 🗺️ Milestones

### Milestone 1: Enhance Edge Evaluation with Road Rules (Addresses point 6)

_Focus: Augment the `AlternativeEdgeEvaluation` model and `InspectorPanel` to explicitly surface road rules, traffic signs, and turn directions._

- [ ] **Task 1: Expose Explicit Rule Modifiers**
  - _Details_: Update `evaluateEdge` and `AlternativeEdgeEvaluation` in `router.ts`/`types.ts` to explicitly capture the source of penalties. This includes the stringified reason (e.g., "Left Turn Penalty (+5s)", "Restricted Shared Path", "Stop Sign (+8s)").
- [ ] **Task 2: UI Representation in Inspector Panel**
  - _Details_: Update `InspectorPanel.tsx` to prominently display these explicit rule violations or penalties per edge. Instead of just "Penalty: +X", map it to the "road rules" domain (e.g., "Right Turn", "Traffic Light").

### Milestone 2: Meaningful Node Filtering (Addresses points 1 and 5)

_Focus: Clean up the map visualization to only highlight nodes with valid routing alternatives, preventing user frustration._

- [ ] **Task 1: Improve Backward Edge Filtering**
  - _Details_: Although a basic backward filter exists, ensure it comprehensively handles complex intersection geometries (e.g., U-turns or split dual-carriageways) so the "way backwards" never appears as a valid alternative.
- [ ] **Task 2: Hide Nodes Without Alternatives**
  - _Details_: Update `InspectorLayer.tsx` to conditionally skip rendering the interactive circle for any node where `alternativeEvaluations` (minus the chosen edge and backwards edge) is empty.

### Milestone 3: Full Alternative Path Projection (Addresses point 4)

_Focus: Allow users to visualize the complete "what-if" journey when hovering or selecting an alternative edge from a node._

- [ ] **Task 1: Compute Full Alternative Paths**
  - _Details_: When `selectedNodeId` is active, run a lightweight Dijkstra projection from the alternative outgoing edges to the final destination to compute the _full_ alternative route cost, distance, and signal count.
- [ ] **Task 2: Hover Comparisons**
  - _Details_: Implement hover interactions in `InspectorLayer.tsx` / `RouteAlternativesLayer.tsx` that display a tooltip summarizing the difference in Time, Distance, and Signals if the hovered path were taken instead of the main route.

### Milestone 4: Layer Visibility Fixes (Addresses point 2)

_Focus: Ensure background UI elements do not conflict with the Inspector's focus._

- [ ] **Task 1: Hide Inactive Strategies**
  - _Details_: Update `RouteAlternativesLayer.tsx` to set the opacity of non-active global route strategies (quiet, avoid-stops) to `0.0` when `isInspectorModeActive` is true, ensuring only the selected route and the node's alternatives are visible.

## 📝 Notes & Open Questions

- **Performance**: Projecting full alternative routes (Milestone 3, Task 1) could be computationally expensive if done synchronously for many edges. We should offload this to the Web Worker (`router.worker.ts`) or only compute it when the user explicitly hovers/clicks an alternative.
- **Mobile Compatibility**: Hover features will need a tap-to-select fallback for mobile, but as requested, this is deferred for now.
