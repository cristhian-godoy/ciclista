# Milestone 1: Time Calibration & Analytics

## Current Focus: Completed!

## Phase A: Time Calibration

- [x] **Bite A.3: Separate routing weight from display cost**
  - [x] Update `src/core/types.ts` to include a way to extract/return `displayCost` (travel time prediction) separately from the routing weight.
  - [x] Implement `displayCost` calculation (pure time = distance / speed + actual wait delays) in `src/core/router/cost.ts`.
  - [x] Update Dijkstra search in `src/core/router/router.ts` to track and return the total accumulated `displayCost` (travel time in seconds) on the resulting path, while still using the preference-weighted `routingCost` for pathfinding.

## Phase B: Yield / Crossing Detection

- [x] **Bite B.1: Centralize node control classifier**
  - [x] Implement a unified node classification function `mapOSMNodeToControl(tags)` in `src/core/router/rules.ts` to classify nodes as `signal`, `yield`, `stop`, or `crossing`.
- [x] **Bite B.2: Count controls in RouteResult**
  - [x] Add `yieldCount: number`, `signalCount: number`, and `crossingCount: number` to `RouteResult` in `src/core/types.ts`.
  - [x] Populate these counters in the path reconstruction loop in `src/core/router/router.ts`.

## Phase C: Road-type Mix

- [x] **Bite C.1: Accumulate road-type distance per edge**
  - [x] Track distance composition by highway type (`cycleway | residential | primary | other`) along the computed path in `src/core/router/router.ts`.
  - [x] Add `roadTypeTotals: Record<string, number>` to `RouteResult`.

## Phase D: Alternative Routes

- [x] **Bite D.1: Multi-route result type**
  - [x] Add `RouteAlternative` interface to `src/core/types.ts`.
- [x] **Bite D.2: Run 3 alternatives in App**
  - [x] In `src/App.tsx`, calculate three route alternatives: Standard, Avoid Stops, and Quiet Streets.
- [x] **Bite D.3: Draw all alternatives on map**
  - [x] Update `src/components/MapView.tsx` to render all three lines with distinct colors and opacity. Clicking a line selects it.
- [x] **Bite D.4: Alternative selector in sidebar**
  - [x] Add alternative selector cards to `src/components/Sidebar.tsx` to switch the active selection.

## Phase E: Analytics Comparison Panel

- [x] **Bite E.1: Comparison table component**
  - [x] Create `src/components/RouteComparePanel.tsx` to show a side-by-side comparison of the routes (Time, Distance, Control points, Road mix).
