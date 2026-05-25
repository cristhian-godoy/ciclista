# Ciclista Platform: Further Improvements & Roadmap (Archived)

This document outlines the completed roadmap to elevate the Ciclista platform.

---

## Milestone 1: Architectural Foundation & Code Organization

**Objective:** Unblur the boundaries between UI and core business logic, eliminate "God Components", and ensure highly maintainable React architecture.

### Phase 1.1: Component Extraction & DRY

- [x] Extract `mergeGraphs` logic from `App.tsx` into `src/core/graph/utils.ts`.
- [x] Extract `getEffectiveSpeedType()` domain logic from `RulesRows.tsx` into `src/core/router/rules.ts`.
- [x] Refactor `cost.ts` to unify the duplicated fallback penalty logic found in `standardCost` and `avoidStoppingCost` into a single penalty-resolution function.
- [x] Relocate `DEFAULT_RULES_CONFIG` from the `RulesConfigPanel.tsx` UI layer to `src/core/router/rules.ts` to fix dependency inversion.

### Phase 1.2: Dismantling the God Component

- [x] Implement a `<MapProvider>` React Context or use the Compound Components pattern for `MapView.tsx` (which currently takes 18 props).
- [x] Remove mutable ref prop drilling (`shouldFitBoundsRef`) and replace it with a declarative event bus or context state for controlling camera fitting.

### Phase 1.3: App State Abstraction

- [x] Abstract the massive global state living in `App.tsx` (`startCoord`, `graph`, `loadedBBoxes`, `isFetchingOSM`) into focused custom hooks (e.g., `useOSMData`, `useRoutingState`).

---

## Milestone 2: Performance & Scalability

**Objective:** Optimize routing speed for large maps, reduce main-thread blocking, and handle async data storage efficiently.

### Phase 2.1: Storage & Memory Optimizations

- [x] Replace the synchronous `LocalStorageProvider` (which uses `JSON.parse`/`stringify` on the main thread for every node edit) with an async `IndexedDB` solution (e.g., `idb`) or a debounced write queue to prevent UI stutter.
- [x] Swap `haversineDistance` with a faster flat-earth Pythagorean approximation for distance calculations between adjacent graph nodes to speed up OSM parsing.
- [x] Refactor Dijkstra's underlying data structures to use typed arrays with integer IDs rather than JavaScript string `Map`s for maximum memory efficiency.

### Phase 2.2: Concurrent WebWorker Routing

- [x] Refactor `router.findRoute` so it no longer mutates the global graph in place (currently used for virtual node injection).
- [x] Offload the triple-routing calculation (`standard`, `avoid-stops`, `quiet-streets`) from the main thread's `useMemo` to a dedicated WebWorker to eliminate UI freezing.

### Phase 2.3: Cache Management

- [x] Implement cache eviction logic and a TTL for `overpass.ts`'s `CacheStorage` so the user's browser doesn't bloat indefinitely.
- [x] Add `stale-while-revalidate` logic to seamlessly update map data in the background.

---

## Milestone 3: Domain Logic & Routing Fidelity

**Objective:** Fix existing routing bugs, improve data accuracy, and expand terrain awareness.

### Phase 3.1: Parsing Fixes

- [x] Fix the unit parsing bug in `parser.ts` where `parseInt(wayTags.maxspeed)` naively converts values like `"50 mph"` to `50 km/h`.
- [x] Fix the `CYCLEWAY_NEGATIVE` rule flaw in `rules.ts`: ensure `cycleway=sidepath` is recognized as a separated cycle track, not penalized.

### Phase 3.2: Generalize Localization Rules

- [x] Decouple `mapOSMToSignAndRoad` from strict German traffic signs (`VZ_244_1`, etc.). Map OSM tags to generic internal routing concepts to ensure the Amsterdam preset (and future cities) routes natively.

### Phase 3.3: Surface Type Awareness

- [x] Introduce granular surface parsing (Paved vs. Gravel vs. Cobblestone).
- [x] Apply distinct cost penalties to surface types based on the selected `bikeProfile` (e.g., Road bike penalizes gravel).
- [x] Update the `RouteComparePanel` UI to show the granular surface mix.

---

## Milestone 4: Design System & UX Polish

**Objective:** Perfect the glassmorphism aesthetic, introduce layout fluidity, and standardize the visual language.

### Phase 4.1: Token Enforcement & Styling Consistency

- [x] Strip all inline styling and hardcoded RGB colors from components (e.g., `RouteComparePanel`, `RoutingConfigPanel`) and move them to `components.css`.
- [x] Enforce the use of `--ciclista-*` design tokens exclusively. Use `color-mix()` or dedicated opacity variables for translucency.
- [x] Replace all inconsistent system emojis (🚶, 🚦) with standardized SVGs from `lucide-react`.

### Phase 4.2: Micro-Interactions & Animations

- [x] Animate the expanding/collapsing of the `RulesConfigPanel` accordions and the reordering of the `RouteComparePanel` table using CSS animations.
- [x] Add smooth hover transitions and custom interaction states across panels.

### Phase 4.3: Ergonomic Adjustments

- [x] Fix the UI render flashing on load by removing the `setTimeout(..., 0)` hack inside `useOverrides.ts`.
- [x] Increase base padding inside `.ciclista-card` to reduce visual claustrophobia.
- [x] Add a CSS fade-out mask (`mask-image: linear-gradient(...)`) to the bottom of the scrolling sidebar for a premium glass depth effect.
