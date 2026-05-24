# Code Cleanup and Refactoring Plan

This document outlines a phased approach to improving the repository's code quality, modularity, and testing, keeping the system clean and maintainable.

## Phase 1: Automation & Linting Standardization

_Goal: Ensure all new code adheres to a consistent format and passes lint checks before entering the commit history._

- [x] Install Prettier and its ESLint integrations (`prettier`, `eslint-config-prettier`, `eslint-plugin-prettier`).
- [x] Create a `.prettierrc` configuration file with project-specific formatting rules.
- [x] Install `husky` and `lint-staged` as development dependencies.
- [x] Initialize Husky and configure the `pre-commit` hook.
- [x] Configure `lint-staged` in `package.json` to run Prettier and ESLint on staged files.
- [x] Re-enable the `'react-hooks/set-state-in-effect'` rule in `eslint.config.js` and fix any resulting violations.

## Phase 2: Type Organization

_Goal: Prevent `types.ts` from becoming a monolithic bottleneck by co-locating types with their respective domains._

- [x] Create `src/core/router/types.ts` and move router-specific interfaces from `src/core/types.ts`.
- [x] Create `src/core/graph/types.ts` and move graph/parsing-specific interfaces.
- [x] Create `src/core/storage/types.ts` and move storage-specific interfaces.
- [x] Update all import statements across the codebase to point to the new domain-specific type files.
- [x] Remove the old `src/core/types.ts` file if it is empty, or rename it to `src/core/common/types.ts` for shared interfaces.

## Phase 3: UI Component De-structuring (Part 1 - App & Sidebar)

_Goal: Break down the largest React components to follow the Single Responsibility Principle._

- [x] Analyze `src/App.tsx` and extract layout/scaffolding into smaller wrapper components if necessary.
- [x] Break down `src/components/RulesConfigPanel.tsx` into smaller chunks (e.g., individual rule toggle components, slider sections).
- [x] Break down `src/components/Sidebar.tsx` by extracting the routing input fields and the stats panel into separate files.

## Phase 4: UI Component De-structuring (Part 2 - MapView)

_Goal: Refactor the heavily-loaded `MapView.tsx` into manageable, isolated layers and components._

### Phase 4.1: Custom Hook Creation & Map Setup Extraction

- [x] Create a custom React hook `useMapInstance` in `src/components/map/useMapInstance.ts` that:
  - Initializes the `maplibregl.Map` instance inside a container reference.
  - Registers standard navigation controls and basic event listeners (`load`, `dragstart`, `zoomstart`, `moveend`, `click`, `contextmenu`).
  - Synces center/zoom values with preset switches (`munich` vs `amsterdam`).
  - Cleans up and removes the map instance on component unmount.
  - Exposes `{ map, mapContainerRef, mapReady }`.

### Phase 4.2: Layer Components Extraction

- [x] Create `src/components/map/StreetGraphLayer.tsx` that:
  - Adds/manages the `network-streets` and `traffic-lights` GeoJSON sources.
  - Adds/manages layers: `network-streets-layer`, `traffic-lights-cluster` (crossings), and `traffic-lights-unclustered` (individual signals).
  - Listens to dependencies (`graph`, `customNodeDelays`, `showMinorControls`) and dynamically re-updates source data.
  - Controls layer filters dynamically when a cluster is expanded/managed (`managedClusterId`, `managedNodeIds`).
  - Attaches click/hover handlers to layers for selecting control nodes and zooming into clusters.
- [x] Create `src/components/map/RouteAlternativesLayer.tsx` that:
  - Adds/manages the `route-path-standard`, `route-path-avoid-stops`, and `route-path-quiet-streets` sources and layers (both core lines and opacity glows).
  - Updates layer paint properties (line opacity, line width) and layers draw order to bring the active route alternative to the front.
  - Computes and fits map bounding boxes smoothly when the active strategy changes.
  - Registers mouseenter, mouseleave, and click events on route layers for selection.
- [x] Create `src/components/map/BBoxBoundaryLayer.tsx` that:
  - Adds/manages the `loaded-bbox` source and polygon layer showing downloaded regions.
  - Translates `loadedBBoxes` to Polygon GeoJSON features and syncs source data.

### Phase 4.3: Marker & Popup Components Extraction

- [x] Create `src/components/map/StartEndMarkers.tsx` that:
  - Synchronizes start and end coordinates with draggable HTML marker pins.
  - Manages marker lifecycles (instantiating, updating LngLat, dragging, and clean removal).
- [x] Create `src/components/map/NodePopup.tsx` that:
  - Renders the glassmorphic modal configuring control node delays, presets, notes, and raw OSM tags.
  - Projects the 3D map coordinates of the selected node into 2D screen coordinates using map event listeners (`move`, `zoom`).
- [x] Create `src/components/map/MapContextMenu.tsx` that:
  - Renders the floating right-click context menu options (`Start Route Here`, `End Route Here`, `Manage Traffic Lights`).
- [x] Create `src/components/map/MapLayerDock.tsx` that:
  - Renders the collapsible layers bottom overlay controls dock (expanding/collapsing and toggling minor controls).

### Phase 4.4: MapView Integration & Cleanup

- [x] Refactor `src/components/MapView.tsx` to serve as a high-level orchestrator:
  - Invoke `useMapInstance` hook.
  - Render the target container `div`.
  - Once the map is loaded and ready, mount the extracted subcomponents as React children, passing down the map instance and coordinate state props.
- [x] Verify that full application flow (routing, marker dragging, customized delays, loading presets, and toggling layers) works identically to the original monolithic implementation.

---

## Phase 5: UI Testing Integration

_Goal: Setup React DOM testing, mock heavy browser APIs (MapLibre GL), and introduce unit and integration tests for UI components._

### Phase 5.1: Test Infrastructure Setup

- [ ] Install testing dependencies:
  - `@testing-library/react` (for testing components)
  - `@testing-library/jest-dom` (for standard DOM assertions)
  - `@testing-library/user-event` (for realistic event simulations)
  - `jsdom` (as a browser-like environment for Vitest)
- [ ] Configure `vite.config.ts` to support Vitest configuration:
  - Add a `test` property specifying `environment: 'jsdom'` and a setup file.
- [ ] Create a Vitest setup file `src/test/setup.ts` to extend matching assertions (import `@testing-library/jest-dom`).
- [ ] Ensure that running the existing unit tests (`pnpm test`) continues to work successfully.

### Phase 5.2: Mocking Utilities

- [ ] Create a robust MapLibre GL stub mock in `src/test/mocks/maplibre-gl.ts` or directly in `src/test/setup.ts` to mock:
  - `Map` class (stubbing events `on`, `off`, `addSource`, `addLayer`, `getSource`, `remove`, `fitBounds`, `easeTo`, `project`, `getBounds`, `getZoom`, `addControl`, `getCanvas`).
  - `Marker` class (stubbing dragging handlers, draggable options, and DOM positioning).
  - `NavigationControl`, `LngLatBounds`, and basic structures.

### Phase 5.3: Unit Testing Extracted UI Components

- [ ] Write unit tests for `RulesRows.tsx`:
  - Verify that rules are rendered with correct styling and checked state.
  - Verify that toggling togglers correctly calls state change handlers.
- [ ] Write unit tests for `RoutingConfigPanel.tsx` / `RulesConfigPanel.tsx`:
  - Assert that sliders display correct penalty values.
  - Mock state hooks and trigger value changes to verify callbacks.
- [ ] Write unit tests for `MapLayerDock.tsx`:
  - Assert that dock renders collapsed and expands on click.
  - Test clicking "Show Minor Controls" triggers layer toggle handlers.

### Phase 5.4: Integration Testing for Panels & Popups

- [ ] Write unit tests for `RouteStatsPanel.tsx` and `RouteComparePanel.tsx`:
  - Verify display calculations for distance (km), duration (minutes), stops count, quietness index percentage.
  - Verify alternative cards render active styles.
- [ ] Write integration tests for `NodePopup.tsx`:
  - Mock projected coordinates from map instance.
  - Assert node details (ID, type label, tags table) render accurately.
  - Simulate moving the slider and clicking preset buttons (e.g. Always Green, Standard, Slow).
  - Assert clicking "Save" calls `onSaveNodeOverride` with the updated seconds/notes.
- [ ] Write integration tests for `Sidebar.tsx`:
  - Mount Sidebar with mocked dependencies.
  - Test tab switching functionality between "Route Info", "Routing Options", and "Rules Config".
  - Assert preset dropdown changes options correctly.
