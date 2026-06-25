# Amend 3 Plan: Relevant Crossings Refactoring

## 🎯 Objective

Refine the algorithm's interpretation of OpenStreetMap (OSM) crossing data to differentiate between "Relevant Crossings" (which strictly require yielding, stopping, or pausing) and "Irrelevant Crossings" (informal crossings or those where the cyclist has right-of-way). Ensure this distinction is propagated through the routing engine, cost calculations, and visual inspector layers.

## 🧐 The Misunderstanding

Currently, the codebase broadly categorizes many `highway=crossing` or `crossing=*` tags as a generic `crossing` control type. However, OSM contains numerous crossings that do not require any action from a cyclist (e.g., `crossing=unmarked`, `crossing=informal`, or generic footway intersections). Penalizing or visually flagging every single OSM crossing creates routing inaccuracies (inflated travel times) and unnecessary map clutter in the Inspector mode.

## 🗺️ Milestones

### Milestone 1: Refine OSM Node Classification

_Focus: Isolate crossings that strictly mandate yielding or waiting._

- [ ] **Task 1: Update `mapOSMNodeToControl`**
  - _Details_: In `src/core/router/rules.ts`, update the control classification logic.
    - Keep `crossing=traffic_signals` classified as `signal`.
    - Restrict the generic `crossing` classification to strictly relevant tags (e.g., `crossing=zebra`, `crossing=marked`).
    - Explicitly ignore tags like `crossing=unmarked`, `crossing=informal`, or bare `highway=crossing` tags lacking explicit priority rules, returning `null` so they are treated as standard nodes.

### Milestone 2: Propagate to Cost Functions

_Focus: Ensure routing delays are only applied to relevant crossings._

- [ ] **Task 1: Audit Cost Calculations**
  - _Details_: Verify that `src/core/router/cost.ts` and `rules-impacts.ts` only apply the `crossingSeconds` penalty when the node control evaluates strictly to a relevant `crossing`, `signal`, `yield`, or `stop`.
  - _Details_: Irrelevant crossings must incur 0 delay and should not increment the `crossingCount` telemetry in the `RouteResult`.

### Milestone 3: Inspector Visualization Updates

_Focus: Clean up the map by hiding irrelevant crossing symbols._

- [ ] **Task 1: Update Domain Mapper**
  - _Details_: Ensure `mapRouteToInspectorGeoJSON` in `src/core/inspector/mapper.ts` relies exclusively on the updated `mapOSMNodeToControl` logic so that it only generates an `InspectorNodeFeature` for relevant crossings.
- [ ] **Task 2: UI Documentation**
  - _Details_: Add a tooltip or legend note in the Inspector Panel explaining that the `🚸` icon represents "Priority/Marked Crossings" requiring a yield, clarifying that informal crossings are intentionally ignored.
