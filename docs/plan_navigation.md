# Plan: Turn-by-Turn Navigation Mode

## 🎯 Objective

Introduce a real-time navigation mode that guides the rider along a pre-computed route. The system tracks position (via Geolocation API in production, WASD keyboard input in development), snaps the position to the active route polyline, controls map camera orientation, and presents ride-completion statistics.

---

## Architecture Overview

The feature is decomposed into four decoupled layers:

```
┌─────────────────────────────────────────────────────┐
│  Position Provider (core/navigation/position.ts)    │
│  GPS vs. WASD — unified Coordinate stream           │
├─────────────────────────────────────────────────────┤
│  Navigation Engine (core/navigation/engine.ts)      │
│  Route snapping, progress tracking, interpolation   │
├─────────────────────────────────────────────────────┤
│  React State (hooks/useNavigation.ts)               │
│  Orchestrates providers + engine, exposes state     │
├─────────────────────────────────────────────────────┤
│  Map + UI Layers                                    │
│  NavigationLayer, NavigationPanel, ArrivalPanel     │
└─────────────────────────────────────────────────────┘
```

All navigation types live in `core/navigation/types.ts`. The engine is a pure-function module with no React dependency — fully unit-testable.

---

## 🗺️ Milestones

### Milestone 1: Type System and Navigation Engine (Pure Logic)

_Focus: Define all data structures and implement the route-snapping / progress-tracking algorithms as pure functions with no framework dependency._

- [x] **Define navigation types** → `src/core/navigation/types.ts`
  - _Details_:
    - `NavigationStatus`: union `'idle' | 'active' | 'paused' | 'arrived'`.
    - `CameraMode`: union `'north-up' | 'heading-up'`.
    - `SnappedPosition`: `{ coordinate: Coordinate; bearing: number; segmentIndex: number; fractionAlongSegment: number; distanceFromRawM: number; }`. The `segmentIndex` + `fractionAlongSegment` pair uniquely identifies where on the polyline the rider is. `distanceFromRawM` is the Haversine distance between the raw GPS coordinate and the snapped point — useful for off-route detection thresholds later.
    - `NavigationProgress`: `{ distanceCoveredM: number; distanceRemainingM: number; etaSeconds: number; elapsedSeconds: number; averageSpeedKmh: number; currentSpeedKmh: number; }`.
    - `NavigationState`: `{ status: NavigationStatus; cameraMode: CameraMode; snapped: SnappedPosition | null; progress: NavigationProgress | null; routeCoordinates: Coordinate[]; startTimestamp: number | null; }`.
    - `RideStats`: `{ totalDistanceM: number; totalTimeSeconds: number; averageSpeedKmh: number; maxSpeedKmh: number; trafficLightsEncountered: number; routeProfile: string; }`. Displayed on arrival.
    - `DetourRequest` (stub): `{ currentPosition: Coordinate; remainingRoute: Coordinate[]; reason: 'off_route' | 'user_requested'; }`. Exported but unused — reserves the API surface for future rerouting.

- [x] **Implement route snapping** → `src/core/navigation/engine.ts`
  - _Details_:
    - `snapToRoute(raw: Coordinate, routeCoords: Coordinate[], hint: { lastSegmentIndex: number }): SnappedPosition`. Uses `projectPointOnSegment` from `core/common/geometry.ts`. The `hint` parameter enables a **forward-search optimisation**: start scanning from the last known segment and search forward up to N segments (e.g. 10) before falling back to a full polyline scan. This prevents O(n) scans per GPS tick.
    - The bearing at the snapped point is computed from the segment vector direction (reuse or inline a bearing formula consistent with `core/common/geo.ts` patterns).

- [x] **Implement GPS interpolation / smoothing** → same file, `engine.ts`
  - _Details_:
    - `interpolatePosition(previous: SnappedPosition, current: SnappedPosition, alpha: number): SnappedPosition`. Linear interpolation along the route polyline between two snapped points. `alpha` ∈ [0, 1] is a smoothing factor (e.g. 0.3 for responsive but dampened movement). This is an exponential moving average (EMA) applied on the `segmentIndex + fractionAlongSegment` 1-D parameter space, not on raw lat/lng, so the interpolated point always stays on the route line.
    - If the raw GPS jumps backwards along the route (negative delta), clamp to the previous position to avoid the marker "rewinding".

- [x] **Implement progress calculation** → same file, `engine.ts`
  - _Details_:
    - `computeProgress(snapped: SnappedPosition, routeCoords: Coordinate[], startTimestamp: number, currentTimestamp: number): NavigationProgress`. Sums segment distances up to `segmentIndex` plus the fractional part. `etaSeconds` is derived from `distanceRemainingM / averageSpeedKmh` with a floor clamp using the route's `totalDurationSeconds` as a sanity bound.

- [x] **Implement ride-stats builder** → same file, `engine.ts`
  - _Details_:
    - `buildRideStats(progress: NavigationProgress, route: RouteResult, maxSpeedKmh: number): RideStats`. Pure function that assembles the stats object from accumulated values.

- [x] **Unit tests** → `src/core/navigation/engine.test.ts`
  - _Details_: Test the four exported functions with deterministic coordinate arrays. Cover: straight-line route, L-shaped route, U-turn suppression, backward-jump clamping, arrival detection (snapped at last segment with fraction ≈ 1.0), and hint-based search acceleration. Test `interpolatePosition` with alpha = 0 (no smoothing), alpha = 1 (full snap), and intermediate values. No mocks needed — all pure functions.

---

### Milestone 2: Position Providers (GPS + WASD)

_Focus: Abstract the coordinate source behind a common interface so the navigation engine is agnostic to input method._

- [x] **Define provider interface** → `src/core/navigation/position.ts`
  - _Details_:
    - `PositionProvider` interface: `{ start(): void; stop(): void; onPosition: (cb: (coord: Coordinate, timestamp: number) => void) => void; }`.
    - `createGeoProvider(options?: PositionAccuracyOptions): PositionProvider` — wraps `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`. On permission denied, emits an error event (TBD via callback or throw). Filters out positions where `coords.accuracy > 50m` to reject low-quality fixes.
    - `createWASDProvider(initialCoord: Coordinate, speedMPerTick?: number): PositionProvider` — listens to `keydown`/`keyup` on `window`. W/S move along current bearing, A/D rotate bearing ±5°/tick. Emits position ticks via `requestAnimationFrame`. Default speed: ~8 m/s (≈29 km/h cycling speed). The provider maintains its own internal `{lat, lng, bearing}` state and emits `Coordinate` on every animation frame while keys are held.
    - Export a factory: `createPositionProvider(mode: 'gps' | 'dev'): PositionProvider`. In dev (`import.meta.env.DEV`), default to `'dev'`; in production, default to `'gps'`.

- [x] **GPS permission handling** → same file
  - _Details_:
    - Before calling `watchPosition`, call `navigator.permissions.query({ name: 'geolocation' })` to check state. If `'denied'`, surface error through a callback without calling `watchPosition`.
    - The provider should accept an `onError: (err: GeolocationPositionError) => void` callback.

- [x] **Unit tests** → `src/core/navigation/position.test.ts`
  - _Details_: Test WASD provider with synthetic keydown events. Verify coordinate deltas correspond to expected direction/speed. GPS provider tests can verify that `watchPosition` is called with correct options (mock `navigator.geolocation`).

---

### Milestone 3: Navigation React Hook

_Focus: Wire the engine and providers into React state. Single hook owns the full lifecycle._

- [x] **Implement `useNavigation` hook** → `src/hooks/useNavigation.ts`
  - _Details_:
    - Accepts: `{ routeResult: RouteResult | null; routeCoordinates: Coordinate[] }`.
    - Returns: `{ state: NavigationState; startNavigation: () => void; stopNavigation: () => void; pauseNavigation: () => void; resumeNavigation: () => void; toggleCameraMode: () => void; rideStats: RideStats | null; }`.
    - On `startNavigation()`: instantiate the position provider (auto-select GPS vs WASD based on `import.meta.env.DEV`), subscribe to position ticks, run `snapToRoute` + `interpolatePosition` + `computeProgress` per tick, and set state. Track `maxSpeedKmh` via `Math.max`.
    - On arriving at destination (snapped fraction ≈ 1.0 on last segment): set status to `'arrived'`, call `buildRideStats`, stop provider.
    - On `stopNavigation()`: tear down provider, reset state to idle.
    - Internal `useRef` for the provider instance and the animation-frame-based smoothing loop. Cleanup in `useEffect` return.
    - Expose `cameraMode` so map layer can read it.

- [x] **Integrate into `App.tsx`**
  - _Details_:
    - Call `useNavigation({ routeResult, routeCoordinates: routeResult?.coordinates ?? [] })`.
    - Derive `routeCoordinates` from the active `routeResult`.
    - Pass `navigation.state`, `navigation.startNavigation`, `navigation.stopNavigation`, `navigation.toggleCameraMode`, and `navigation.rideStats` down to `Sidebar` and `MapView` via props.
    - Add `isNavigating: boolean` convenience derived from `state.status === 'active' || state.status === 'paused'`.

- [x] **Extend `MapViewProps` and `MapContextType`**
  - _Details_:
    - Add to `MapViewProps`: `navigationState: NavigationState; isNavigating: boolean;`.
    - Add to `MapContextType` / `MapProvider`: `navigationState: NavigationState; isNavigating: boolean;`.
    - This follows the existing pattern where `MapProvider` receives props from `App` and exposes them via context.

---

### Milestone 4: Map Navigation Layer and Route Styling

_Focus: Render the rider position, control camera, and adjust route line styling during navigation._

- [ ] **Create `NavigationLayer`** → `src/components/map/NavigationLayer.tsx`
  - _Details_:
    - Reads `navigationState` and `isNavigating` from `useMapContext()`.
    - When `isNavigating`:
      - Adds a MapLibre GeoJSON source `nav-position` with a single Point feature at the snapped coordinate.
      - Renders a `symbol` layer using a custom arrow icon (a simple triangle/chevron SVG loaded via `map.addImage`). The icon rotation is bound to `snapped.bearing` via `'icon-rotate': ['get', 'bearing']` in the layer paint properties.
      - Updates the source data on every `navigationState.snapped` change.

- [ ] **Camera control** → same component
  - _Details_:
    - On each snapped position update, call `map.easeTo(...)`:
      - `heading-up` mode: `center: [snapped.coordinate.lng, snapped.coordinate.lat], bearing: snapped.bearing, zoom: 17, pitch: 45, duration: 300`. This creates the "driving view" where the map rotates so the direction of travel is always up.
      - `north-up` mode: `center: [snapped.coordinate.lng, snapped.coordinate.lat], bearing: 0, zoom: 16, pitch: 0, duration: 300`. Classic top-down north-facing view.
    - Use a `useRef` for debouncing — do not call `easeTo` more than once per 250ms to avoid jank.

- [ ] **Navigation route line styling** → `RouteAlternativesLayer.tsx`
  - _Details_:
    - When `isNavigating` is true (read from `useMapContext`):
      - Hide the non-active alternative route layers (set `line-opacity: 0` on inactive strategies).
      - Increase the active route layer `line-width` to `8` and its glow layer `line-width` to `14`, `line-opacity` to `0.35`. These thicker values provide the "navigation-grade" visual prominence.
      - Optionally split the active route into "covered" (behind the rider, dimmed) and "remaining" (ahead, full brightness) using two GeoJSON features derived from `segmentIndex` + `fractionAlongSegment`. This is a nice-to-have; at minimum, the full line in thicker style is sufficient for M4.

- [ ] **Mount `NavigationLayer`** → `MapView.tsx`
  - _Details_:
    - Add `<NavigationLayer />` inside the `{map && mapReady && (...)}` block, after `<StartEndMarkers />`.

---

### Milestone 5: UI Panels (Start Button, HUD, Arrival)

_Focus: Sidebar integration for triggering navigation, in-ride HUD overlay, and post-ride statistics._

- [x] **"Start Navigation" button in Sidebar** → modify `Sidebar.tsx`
  - _Details_:
    - Accept new props: `isNavigating: boolean; onStartNavigation: () => void; onStopNavigation: () => void; navigationProgress: NavigationProgress | null; onToggleCameraMode: () => void; cameraMode: CameraMode;`.
    - Render a "Start Navigation" button (e.g. with a `Play` Lucide icon) below the `RouteStatsPanel` when `routeResult !== null && !isNavigating`. Button calls `onStartNavigation`.
    - When `isNavigating`, replace the button with a "Stop Navigation" button (with `Square` icon) and display a compact progress summary (distance remaining, ETA).
    - Add a camera-mode toggle button (e.g. `Compass` icon for north-up, `Navigation2` icon for heading-up) next to the stop button.

- [ ] **Navigation HUD overlay** → `src/components/NavigationHUD.tsx` [NEW]
  - _Details_:
    - A floating overlay positioned at the top-center of the map (via CSS `position: absolute; top: 16px; left: 50%; transform: translateX(-50%);`).
    - Displays: current speed (km/h), ETA, distance remaining.
    - Uses the existing `ciclista-glass-panel` CSS class for consistency.
    - Only visible when `isNavigating`.
    - Mount in `MapView.tsx` outside the MapLibre layers, as a sibling to `<MapContextMenu />`.

- [ ] **Arrival panel** → `src/components/ArrivalPanel.tsx` [NEW]
  - _Details_:
    - A modal/overlay displayed when `navigationState.status === 'arrived'`.
    - Renders `RideStats`: total distance, total time, average speed, max speed, traffic lights encountered, route profile used.
    - "Close" button dismisses and resets navigation state to idle (calls `stopNavigation`).
    - Reuses existing design tokens and `ciclista-glass-panel` / `ciclista-card` classes.

- [ ] **Wire UI props through `App.tsx`**
  - _Details_:
    - Pass `isNavigating`, `onStartNavigation`, `onStopNavigation`, `navigationProgress`, `onToggleCameraMode`, `cameraMode` to `Sidebar`.
    - Pass `navigationState` and `rideStats` to `MapView` (for HUD and ArrivalPanel mounting).

---

### Milestone 6: Integration, Polish, and Dev Tooling

_Focus: End-to-end integration testing, CSS refinements, dev-mode UX._

- [ ] **WASD controls visual indicator** → `NavigationHUD.tsx`
  - _Details_:
    - When `import.meta.env.DEV`, render a small badge or text "(WASD)" next to the speed readout so the developer knows keyboard input is active.

- [ ] **Sidebar auto-collapse during navigation**
  - _Details_:
    - When `startNavigation` is called, auto-collapse the sidebar (`setIsCollapsed(true)`) to maximise map viewport. This requires either lifting the `isCollapsed` state to `App.tsx` or passing a `forceCollapse` prop.

- [ ] **Disable route editing during navigation**
  - _Details_:
    - When `isNavigating`, disable pin dragging in `StartEndMarkers.tsx` (skip marker creation or set `draggable: false`).
    - Suppress context menu route-point actions in `MapContextMenu.tsx`.
    - Disable strategy switching in `RouteStatsPanel.tsx`.

- [ ] **Update `.info` files**
  - _Details_: Add `.info` entries for `src/core/navigation/` directory and each new file, following the existing `tree --info` annotation pattern.

- [ ] **Integration test** → `src/components/map/NavigationLayer.test.tsx`
  - _Details_: Mount `NavigationLayer` within a mocked `MapProvider`, verify that the GeoJSON source is updated when `navigationState.snapped` changes, and that `map.easeTo` is called with the correct bearing for each camera mode.

---

## File Inventory

| Action | Path                                            | Purpose                                                |
| ------ | ----------------------------------------------- | ------------------------------------------------------ |
| NEW    | `src/core/navigation/types.ts`                  | All navigation-domain type definitions                 |
| NEW    | `src/core/navigation/engine.ts`                 | Pure functions: snap, interpolate, progress, rideStats |
| NEW    | `src/core/navigation/engine.test.ts`            | Unit tests for engine                                  |
| NEW    | `src/core/navigation/position.ts`               | GPS + WASD providers behind unified interface          |
| NEW    | `src/core/navigation/position.test.ts`          | Provider tests                                         |
| NEW    | `src/hooks/useNavigation.ts`                    | React hook orchestrating providers + engine            |
| NEW    | `src/components/map/NavigationLayer.tsx`        | Rider marker + camera control on MapLibre              |
| NEW    | `src/components/NavigationHUD.tsx`              | Floating speed/ETA overlay during navigation           |
| NEW    | `src/components/ArrivalPanel.tsx`               | Post-ride statistics modal                             |
| NEW    | `src/components/map/NavigationLayer.test.tsx`   | Integration test for map layer                         |
| MODIFY | `src/App.tsx`                                   | Wire `useNavigation`, pass props down                  |
| MODIFY | `src/components/Sidebar.tsx`                    | Start/Stop button, camera toggle, progress display     |
| MODIFY | `src/components/MapView.tsx`                    | Mount NavigationLayer, HUD, ArrivalPanel               |
| MODIFY | `src/components/map/MapContext.tsx`             | Extend context with navigationState, isNavigating      |
| MODIFY | `src/components/map/RouteAlternativesLayer.tsx` | Thicker line + hide inactive during nav                |
| MODIFY | `src/components/map/StartEndMarkers.tsx`        | Disable dragging during nav                            |

---

## 📝 Notes & Open Questions

- **Detour / rerouting**: `DetourRequest` type is defined but no implementation is planned. The `engine.ts` exports and `useNavigation` hook are structured so a `requestDetour()` method can be added later without refactoring the state machine.
- **Screen Wake Lock**: Not in scope for this plan but naturally slots into `useNavigation` as a side-effect (`navigator.wakeLock.request('screen')` on start, release on stop).
- **Off-route detection threshold**: `SnappedPosition.distanceFromRawM` carries the data. A reasonable threshold is 50m. When exceeded N consecutive times, a detour could be triggered — but that logic is deferred.
- **Audio / speech cues**: Not in scope. The `engine.ts` progress data provides the inputs needed for a future text-to-speech layer.
- **Route coordinate density**: The route coordinates from `RouteResult` follow OSM graph nodes, which can be sparse on long straight roads. If the snapping produces visible "cutting corners" on curves, a later milestone could interpolate additional points along the route polyline. For now, the existing density from the Dijkstra path reconstruction is sufficient since OSM nodes are typically <50m apart in urban areas.
- **WASD initial position**: Should default to `routeResult.coordinates[0]` (the start of the route) so the dev can immediately begin simulating the ride.
