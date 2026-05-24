# Ciclista Platform: Further Improvements & Roadmap

This document outlines a concrete, phased roadmap to elevate the Ciclista platform. It is synthesized directly from the deep codebase audit, categorized by strategic milestones, and broken down into bite-sized, actionable tasks.

---

## Milestone 1: Architectural Foundation & Code Organization

**Objective:** Unblur the boundaries between UI and core business logic, eliminate "God Components", and ensure highly maintainable React architecture.

### Phase 1.1: Component Extraction & DRY

- [ ] Extract `mergeGraphs` logic from `App.tsx` into `src/core/graph/utils.ts`.
- [ ] Extract `getEffectiveSpeedType()` domain logic from `RulesRows.tsx` into `src/core/router/rules.ts`.
- [ ] Refactor `cost.ts` to unify the duplicated fallback penalty logic found in `standardCost` and `avoidStoppingCost` into a single penalty-resolution function.
- [ ] Relocate `DEFAULT_RULES_CONFIG` from the `RulesConfigPanel.tsx` UI layer to `src/core/router/rules.ts` to fix dependency inversion.

### Phase 1.2: Dismantling the God Component

- [ ] Implement a `<MapProvider>` React Context or use the Compound Components pattern for `MapView.tsx` (which currently takes 18 props).
- [ ] Remove mutable ref prop drilling (`shouldFitBoundsRef`) and replace it with a declarative event bus or context state for controlling camera fitting.

### Phase 1.3: App State Abstraction

- [ ] Abstract the massive global state living in `App.tsx` (`startCoord`, `graph`, `loadedBBoxes`, `isFetchingOSM`) into focused custom hooks (e.g., `useOSMData`, `useRoutingState`).

---

## Milestone 2: Performance & Scalability

**Objective:** Optimize routing speed for large maps, reduce main-thread blocking, and handle async data storage efficiently.

### Phase 2.1: Storage & Memory Optimizations

- [ ] Replace the synchronous `LocalStorageProvider` (which uses `JSON.parse`/`stringify` on the main thread for every node edit) with an async `IndexedDB` solution (e.g., `idb`) or a debounced write queue to prevent UI stutter.
- [ ] Swap `haversineDistance` with a faster flat-earth Pythagorean approximation for distance calculations between adjacent graph nodes to speed up OSM parsing.
- [ ] Refactor Dijkstra's underlying data structures to use typed arrays with integer IDs rather than JavaScript string `Map`s for maximum memory efficiency.

### Phase 2.2: Concurrent WebWorker Routing

- [ ] Refactor `router.findRoute` so it no longer mutates the global graph in place (currently used for virtual node injection).
- [ ] Offload the triple-routing calculation (`standard`, `avoid-stops`, `quiet-streets`) from the main thread's `useMemo` to a dedicated WebWorker to eliminate UI freezing.

### Phase 2.3: Cache Management

- [ ] Implement cache eviction logic and a TTL for `overpass.ts`'s `CacheStorage` so the user's browser doesn't bloat indefinitely.
- [ ] Add `stale-while-revalidate` logic to seamlessly update map data in the background.

---

## Milestone 3: Domain Logic & Routing Fidelity

**Objective:** Fix existing routing bugs, improve data accuracy, and expand terrain awareness.

### Phase 3.1: Parsing Fixes

- [ ] Fix the unit parsing bug in `parser.ts` where `parseInt(wayTags.maxspeed)` naively converts values like `"50 mph"` to `50 km/h`.
- [ ] Fix the `CYCLEWAY_NEGATIVE` rule flaw in `rules.ts`: ensure `cycleway=sidepath` is recognized as a separated cycle track, not penalized.

### Phase 3.2: Generalize Localization Rules

- [ ] Decouple `mapOSMToSignAndRoad` from strict German traffic signs (`VZ_244_1`, etc.). Map OSM tags to generic internal routing concepts to ensure the Amsterdam preset (and future cities) routes natively.

### Phase 3.3: Surface Type Awareness

- [ ] Introduce granular surface parsing (Paved vs. Gravel vs. Cobblestone).
- [ ] Apply distinct cost penalties to surface types based on the selected `bikeProfile` (e.g., Road bike penalizes gravel).
- [ ] Update the `RouteComparePanel` UI to show the granular surface mix.

---

## Milestone 4: Design System & UX Polish

**Objective:** Perfect the glassmorphism aesthetic, introduce layout fluidity, and standardize the visual language.

### Phase 4.1: Token Enforcement & Styling Consistency

- [ ] Strip all inline styling and hardcoded RGB colors from components (e.g., `RouteComparePanel`, `RoutingConfigPanel`) and move them to `components.css`.
- [ ] Enforce the use of `--ciclista-*` design tokens exclusively. Use `color-mix()` or dedicated opacity variables for translucency.
- [ ] Replace all inconsistent system emojis (🚶, 🚦) with standardized SVGs from `lucide-react`.

### Phase 4.2: Micro-Interactions & Animations

- [ ] Integrate Framer Motion or `react-spring`.
- [ ] Animate the mounting/unmounting of Sidebar panels, the expanding/collapsing of the `RulesConfigPanel` accordions, and the reordering of the `RouteComparePanel` table.
- [ ] Add an SVG pulsing ring animation around start/end markers when they are being dragged.
- [ ] Replace the generic spinning refresh icon with elegant visual skeleton loaders inside the Sidebar while `isFetchingOSM` is true.

### Phase 4.3: Ergonomic Adjustments

- [ ] Fix the UI render flashing on load by removing the `setTimeout(..., 0)` hack inside `useOverrides.ts`.
- [ ] Increase base padding inside `.ciclista-card` to reduce visual claustrophobia.
- [ ] Add a CSS fade-out mask (`mask-image: linear-gradient(...)`) to the bottom of the scrolling sidebar for a premium glass depth effect.

---

## Milestone 5: Core Feature Additions

**Objective:** Bridge the feature gap to compete with professional cycling navigation apps.

### Phase 5.1: Navigation & Export

- [ ] Build GPX / KML Export functionality so cyclists can load generated routes onto Garmin/Wahoo head units.
- [ ] Generate and display a Turn-by-Turn Navigation Cue Sheet (e.g., "Turn left onto Main St in 100m").

### Phase 5.2: Advanced Routing

- [ ] Integrate external elevation data (Topography) to render a route elevation profile chart.
- [ ] Update the Dijkstra cost function to heavily penalize steep climbs.
- [ ] Implement Waypoints (Via points) to allow multi-stop recreational route planning.

### Phase 5.3: Map Discovery

- [ ] Integrate the browser Geolocation API to add a "Center on my location" button.
- [ ] Add Map Overlay toggles to display cycling POIs (Bike shops, drinking fountains, public toilets).
