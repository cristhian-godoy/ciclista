# Amend Plan: Inspector Mode Interaction & Route Alternatives Clarification

## 🎯 Objective

Fix the regressions introduced during the Inspector Mode route visualization implementation. Clarify the strict distinction between global route strategies and local node alternatives. Restore the intended interactive flow where the map remains clean until a specific node is clicked, while still keeping the chosen route's segment colors and signs always visible.

## 🧐 The Misunderstanding

1. **Global vs Local Alternatives**: The 3 main routing strategies (Standard, Avoid Stops, Quiet Streets) were left visible in Inspector Mode, visually clashing with the inspector's detailed segment lines.
2. **"Always-On" Overreach**: The instruction to make the chosen route's colors "always visible" was mistakenly applied to _all local alternative branches_. The mapper (`mapRouteToInspectorGeoJSON`) was plotting every evaluated branch across the entire route simultaneously, creating a confusing spiderweb of lines.
3. **Missing Interactive Nodes**: Because all alternative lines were drawn at once, and because the blue interactive node circles were either filtered out or rendered underneath the thick lines, the user lost the ability to "click a node to see its specific alternatives."

## 🗺️ Milestones

### Milestone 1: Hide Global Strategies in Inspector Mode

_Focus: Clear the map of the 3 main strategy lines when inspecting._

- [ ] **Task 1: Hide RouteAlternativesLayer**
  - _Details_: In `src/components/map/RouteAlternativesLayer.tsx`, ensure that if `isInspectorModeActive` is `true`, the layer opacity for ALL strategies (including the active one) is explicitly set to `0.0`. Currently, the active strategy's line is still rendered at `1.0` opacity, which duplicates and clashes with the colored segments drawn by `InspectorLayer`.

### Milestone 2: Fix the Domain Mapper (Local Alternatives)

_Focus: Only render alternative branches for the selected node._

- [ ] **Task 1: Pass `selectedNodeId` to the Mapper**
  - _Details_: Modify `mapRouteToInspectorGeoJSON(route, graph, selectedNodeId)` in `src/core/inspector/mapper.ts` to accept the currently selected node ID (can be `null`).
- [ ] **Task 2: Filter Alternative Evaluations**
  - _Details_: Inside the mapper, when processing `route.alternativeEvaluations`, ONLY process and push segment features for the `evals` that correspond to `sourceId === selectedNodeId`. Do NOT map alternatives for the entire route.

### Milestone 3: Restore Interactive Node Circles

_Focus: Bring back the ability to click nodes to explore._

- [ ] **Task 1: Restore Node Source Data**
  - _Details_: In `src/components/map/InspectorLayer.tsx`, ensure the `inspector-nodes` source is properly populated with points for nodes along the chosen path that have valid alternatives.
- [ ] **Task 2: Layer Z-Ordering**
  - _Details_: Verify that `inspector-nodes-layer` is rendered visually _above_ `inspector-path-segments-layer`. The interactive blue circles must be easily clickable and not buried under the thick colored line segments.

## 📝 Expected Interaction Flow

1. User activates Inspector Mode.
2. Global strategy lines (Standard, Avoid Stops, Quiet) disappear entirely.
3. The chosen path is rendered as a multi-colored line based on infrastructure types.
4. Traffic signs (🛑, 🚦) and turn arrows along the chosen path are visible.
5. Interactive blue circles appear at intersections along the chosen path.
6. **Crucially: No alternative routing branches are visible yet.**
7. User clicks a blue circle (`selectedNodeId` is set).
8. The mapper runs and now includes the alternative branches evaluated _specifically from that clicked node_. These branches are also color-coded by infrastructure type to explain why they were not chosen.
