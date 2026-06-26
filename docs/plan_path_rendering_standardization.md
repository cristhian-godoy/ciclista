# Plan: Standardize Path Rendering Architecture

## 🎯 Objective

Establish a unified, robust path rendering architecture to eliminate duplicated MapLibre layer management, fix geometry inaccuracies (dropped segments and curved roads) in the inspector, and enable rich, semantic segment coloring across all routing modes (main route, inspector, navigation, and local alternatives).

## 🗺️ Milestones

### Milestone 1: Establish the Path Rendering Data Model (`core/rendering`)

_Focus: Extract geometry translation and styling definitions from React components into a strict, easily testable domain._

- [x] **Task 1: Define `core/rendering/types.ts`**
  - _Details_: Create types for `PathSegmentFeature` (a GeoJSON LineString with associated semantic properties) and `PathStyleConfig` (width, opacity, glowWidth, glowOpacity, dashArray, zIndex).
- [x] **Task 2: Centralize Semantic Theme in `core/rendering/theme.ts`**
  - _Details_: Extract `getColorForEdge` from `src/core/inspector/mapper.ts` and the hardcoded strategy colors from `src/components/map/RouteVariantsLayer.tsx`. Define explicit color palettes for `active`, `inactive` (greyed out/muted variants), `alternative` (local intersection branches), and `semantic` (infrastructure-based coloring).
- [x] **Task 3: Build a Precision Geometry Mapper in `core/rendering/geometry-mapper.ts`**
  - _Details_: Write a pure function `buildSegmentedPathGeoJSON(route: RouteResult)` that slices the highly accurate `RouteResult.coordinates` array instead of drawing straight lines between `graph.nodes`. This strictly fixes the dropped first/last segment bug (from start/end pins to the network) and preserves road curvature in Inspector Mode.
- [x] **Task 4: Extract Node Symbols Mapper**
  - _Details_: Move the extraction of `InspectorNodeFeature` (traffic lights, stops, turn arrows) out of `core/inspector/mapper.ts` into `core/rendering/symbols-mapper.ts` so they can optionally be used by the main route or navigation layers in the future.

### Milestone 2: Develop the Unified React MapLayer Component

_Focus: Replace ad-hoc imperative MapLibre API calls with a declarative, reusable React component._

- [x] **Task 1: Create `components/map/layers/UnifiedPathLayer.tsx`**
  - _Details_: Build a React component that wraps `map.addSource` and `map.addLayer`. It should accept an array of `PathSegmentFeature` objects and a `PathStyleConfig`.
  - _Details_: It must natively manage three MapLibre layers under the hood: a Glow layer (bottom), a Core Path layer (middle), and an optional Semantic Segment layer (top, for multi-color rendering).
- [x] **Task 2: Implement Hover and Selection Events in the Layer**
  - _Details_: Expose `onPathClick`, `onPathHover`, and `onPathLeave` props. Manage cursor states (`pointer`) internally when hovered, eliminating scattered `map.on('mousemove')` listeners across the codebase.

### Milestone 3: Refactor the Main Route Variants

_Focus: Upgrade the primary map view to utilize the new architecture, enabling semantic coloring for standard routes and cleaning up inactive states._

- [x] **Task 1: Refactor `RouteVariantsLayer.tsx`**
  - _Details_: Delete all imperative `map.addLayer` code. Map over `routeVariants` and render a `<UnifiedPathLayer>` for each strategy.
- [x] **Task 2: Apply Advanced Styling Logic**
  - _Details_: Pass configurations from `theme.ts`. For the `activeAlternativeLabel`, apply thick lines, full opacity, glow, and optionally pass `useSemanticColors: true` to display the "cool colors per segment".
  - _Details_: For inactive strategies, pass a `PathStyleConfig` that thins the line, disables the glow, and uses a muted/greyed-out color to reduce visual noise.
- [x] **Task 3: Integrate Navigation Mode State**
  - _Details_: Ensure the `PathStyleConfig` thickens the line significantly (e.g., width 8, glow 14) when `isNavigating` is true, keeping navigation routing logic centralized.

### Milestone 4: Refactor Inspector Mode

_Focus: Migrate the diagnostic view to the unified layer, fixing its routing accuracy and refining its aesthetic._

- [x] **Task 1: Refactor `InspectorLayer.tsx` Path Rendering**
  - _Details_: Remove `inspector-path-segments-layer` and `inspector-highlighted-path-layer`. Replace them with `<UnifiedPathLayer>` instances. Pass the precision geometries generated in Milestone 1.
- [x] **Task 2: Polish Local Alternative Branches**
  - _Details_: Change the dashed local alternative branch rendering to use a designated "alternative branch" color from `theme.ts` (e.g., orange or muted purple) instead of reusing the aggressive red `#ef4444`. Configure its `dashArray` via `PathStyleConfig`.
- [x] **Task 3: Connect the Symbols Layer**
  - _Details_: Ensure the interactive node circles, traffic lights, and turn arrows consume the new `symbols-mapper.ts` outputs.

### Milestone 5: Deprecation and Cleanup

_Focus: Remove deprecated files and finalize the architecture._

- [x] **Task 1: Delete Stale Inspector Mapper**
  - _Details_: Delete `src/core/inspector/mapper.ts` and its associated tests, as their responsibilities are now fully handled by `core/rendering/geometry-mapper.ts`.
- [x] **Task 2: Update Tests**
  - _Details_: Write unit tests for `geometry-mapper.ts` ensuring that it accurately slices `RouteResult.coordinates` and handles paths with missing intermediate edges gracefully.

## 📝 Notes & Open Questions

- **Geometry Slicing Challenge**: Slicing `RouteResult.coordinates` to match `RouteResult.edges` requires careful distance interpolation or coordinate matching, since `coordinates` is a flat array of points. If `RouteResult.edges` do not store exact slice indices, the mapper will need to project coordinates onto the edges or use haversine distances to chunk the path accurately.
- **Performance**: Ensure that switching from single LineStrings to heavily segmented FeatureCollections in the main `RouteVariantsLayer` does not cause MapLibre rendering stutter during zoom/pan on lower-end devices. If it does, we may need a simplified geometry mode when zoomed out.
- **Wiggle Room**: The executor MUST NOT write any MapLibre `.addLayer` or `.addSource` code outside of `UnifiedPathLayer.tsx` for paths. All style definitions MUST live in `core/rendering/theme.ts`.
