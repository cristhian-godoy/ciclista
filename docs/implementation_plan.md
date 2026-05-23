# Route Alternatives & Analytics — Incremental Roadmap

## Premise

### Time estimate accuracy
The app currently shows **65m 34s** for a route the user cycles in **45 min** (slow bike, 18 km/h)
or **36 min** (e-bike, 25 km/h). The cost model was built around routing *preference* (which
path to prefer), not real elapsed-time prediction. Penalties for signals, turns, and road types
inflate the total far beyond reality. Before comparing alternatives the displayed time must be
trustworthy — otherwise the analytics are meaningless. This is the first thing to fix.

### Multiple route alternatives
Google Maps-style: run the routing engine 2–3 times with deliberately different cost functions
and display all results simultaneously so the user can compare them visually and analytically.

### Richer analytics
Side-by-side comparison panel: estimated time (calibrated), distance, signal count, yield count,
road-type mix (% cycleway, % residential, % primary, …). Stops are excluded — almost none in
Munich.

---

## Bite-size rule
**Each bite touches at most 2 files, produces a clean TypeScript build, and is independently
committable.** If a bite feels large, split it. No bite should require understanding another
in-progress bite to be reviewed.

---

## Proposed Changes

### Phase A: Time Calibration

#### Bite A.1 — Speed profile constants  [MODIFY] `src/core/router/cost.ts`
Replace the current ad-hoc per-highway m/s values with a clean `BASE_SPEED_MS` lookup table
driven by a user-selectable bike profile: **Slow (15 km/h)**, **Normal (18 km/h)**,
**E-Bike (25 km/h)**. Signal and turn penalties stay but are expressed as real-world values
(not inflated routing weights). Routing weights live separately.

#### Bite A.2 — Bike profile selector  [MODIFY] `src/components/Sidebar.tsx` + `src/App.tsx`
Add a 3-button profile selector (Slow / Normal / E-Bike) next to the routing strategy selector.
Pass selected profile into `currentOverrides` so cost functions use the right speed.

#### Bite A.3 — Separate routing weight from display cost  [MODIFY] `src/core/router/cost.ts`
Extract a `displayCost` calculation (pure time = distance/speed + real signal delays) separate
from `routingCost` (which keeps the heavy penalties for path preference). Router uses
`routingCost`; analytics display uses `displayCost` accumulated on each edge.

---

### Phase B: Yield / Crossing Detection

#### Bite B.1 — Detect yield nodes  [MODIFY] `src/core/router/rules.ts`
Add `mapOSMNodeToControl(tags)` → `'signal' | 'yield' | 'crossing' | null`. Yields are OSM
`highway=give_way` nodes.

#### Bite B.2 — Count yields in RouteResult  [MODIFY] `src/core/types.ts` + `src/core/router/router.ts`
Add `yieldCount: number` to `RouteResult`. Populate in the path reconstruction loop using
the new node classifier.

---

### Phase C: Road-type Mix

#### Bite C.1 — Accumulate road-type distance per edge  [MODIFY] `src/core/router/router.ts`
While building `edgesDetails`, bucket each edge's distance into a `roadTypeTotals` map
(`cycleway | residential | primary | other`). Add `roadTypeTotals: Record<string, number>` to
`RouteResult`.

---

### Phase D: Alternative Routes

#### Bite D.1 — Multi-route result type  [MODIFY] `src/core/types.ts`
Add `RouteAlternative { label: string; result: RouteResult }[]` — a thin wrapper so the app
can hold multiple results.

#### Bite D.2 — Run 3 alternatives in App  [MODIFY] `src/App.tsx`
In the routing `useMemo`, run all 3 cost functions (standard / avoid-stops / quiet) in one
pass and store as `routeAlternatives: RouteAlternative[]`. Deprecate the single
`routeResult` prop.

#### Bite D.3 — Draw all alternatives on map  [MODIFY] `src/components/MapView.tsx`
Render up to 3 route lines with distinct colours (accent / muted / secondary). Selected
alternative is full opacity; others are 40% opacity. Clicking a line selects it.

#### Bite D.4 — Alternative selector in sidebar  [MODIFY] `src/components/Sidebar.tsx`
Replace the old 3-button strategy selector with a compact card-per-alternative showing
label + headline stats. Clicking a card selects that alternative and highlights its line.

---

### Phase E: Analytics Comparison Panel

#### Bite E.1 — Comparison table component  [NEW] `src/components/RouteComparePanel.tsx`
Side-by-side table: Time / Distance / Signals / Yields / % Cycleway / % Residential / %
Primary. One column per alternative. Replaces the current single Route Analytics section.

---

## Verification Plan
- `pnpm test` green after every bite.
- `npx tsc --noEmit` clean after every bite.
- Manual: set Slow profile → route time should match ~45 min for the reference route.
  Set E-Bike → should approach ~36 min.
