# Route Alternatives & Analytics Checklist

## Phase A: Time Calibration
- [ ] **Bite A.3: Separate routing weight from display cost**
  - [ ] Separate `displayCost` (actual time prediction: distance / speed + signal delays) from `routingCost` (path preferences and routing weights) in `src/core/router/cost.ts`.
  - [ ] Update router to use `routingCost` for routing and accumulate `displayCost` on each edge for total travel time.

## Phase B: Yield / Crossing Detection
- [ ] **Bite B.1: Detect yield nodes**
  - [ ] Implement `mapOSMNodeToControl(tags)` in `src/core/router/rules.ts` to classify nodes as `signal`, `yield`, or `crossing`.
- [ ] **Bite B.2: Count yields in RouteResult**
  - [ ] Add `yieldCount: number` to `RouteResult` in `src/core/types.ts`.
  - [ ] Populate it in the path reconstruction loop in `src/core/router/router.ts`.

## Phase C: Road-type Mix
- [ ] **Bite C.1: Accumulate road-type distance per edge**
  - [ ] Add `roadTypeTotals` map to `RouteResult` and populate it in `src/core/router/router.ts`.

## Phase D: Alternative Routes
- [ ] **Bite D.1: Multi-route result type**
  - [ ] Define `RouteAlternative` in `src/core/types.ts`.
- [ ] **Bite D.2: Run 3 alternatives in App**
  - [ ] Compute 3 alternatives (standard / avoid-stops / quiet) in `src/App.tsx`.
- [ ] **Bite D.3: Draw all alternatives on map**
  - [ ] Render 3 route lines with varying opacities in `src/components/MapView.tsx`.
- [ ] **Bite D.4: Alternative selector in sidebar**
  - [ ] Add card selectors in `src/components/Sidebar.tsx` to choose the active route alternative.

## Phase E: Analytics Comparison Panel
- [ ] **Bite E.1: Comparison table component**
  - [ ] Create `src/components/RouteComparePanel.tsx` to display a side-by-side comparison of the routes.
