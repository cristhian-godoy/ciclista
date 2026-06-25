# Plan: Inspector Mode Route Visualization

## 🎯 Objective

Overhaul the inspector mode to provide an "always-on", domain-driven visual representation of routing paths without requiring hover or click interactions. By color-coding all path segments (both the chosen route and the evaluated alternatives) according to path type, and explicitly drawing traffic controls and turns on the map, we provide immediate visual context for _why_ the algorithm evaluates routes the way it does.

## 🗺️ Milestones

### Milestone 1: Inspector Domain Modeling & Mapping

_Focus: Defining clear boundaries between the routing algorithm's data and the inspector's visual representation._

- [ ] **Task 1: Create Inspector Types**
  - _Details_: Create `src/core/inspector/types.ts`. Define:
    - `InspectorRouteSegment`: GeoJSON LineString representing a single path segment. Properties include `color`, `infrastructureType`, `roadType`, `surface`, and `isChosenPath` (boolean).
    - `InspectorNodeFeature`: GeoJSON Point representing a node event. Properties include `type` ('stop', 'yield', 'signal', 'crossing', 'turn'), `turnDirection` (if applicable), and `bearing`.
- [ ] **Task 2: Implement Domain Mapper**
  - _Details_: Create `src/core/inspector/mapper.ts` to transform `RouteResult` and its `alternativeEvaluations` into GeoJSON feature collections.
    - **Color Mapping Strategy**:
      - _Green_ (Safe/Pleasant): Segregated paths, bicycle streets.
      - _Blue_ (Acceptable): Shared paths, living streets, generic cycle-friendly paths.
      - _Red_ (Danger): Primary/secondary roads with mixed traffic.
      - _Purple_ (Dismount/Penalty): Pedestrian zones, sidewalks.
    - **Symbol Extraction**: Generate point features at the exact coordinates of nodes that carry wait penalties (stops, signals) or significant turns.

### Milestone 3: MapLibre Rendering Engine Updates

_Focus: Implementing "always-visible" visual cues on the map and applying the unified color scheme to both main and alternative routes._

- [ ] **Task 1: Unified Colored Segments Layer**
  - _Details_: In `src/components/map/InspectorLayer.tsx`, remove the old binary red/green (`isChosen`) color scheme for alternatives. Add a new `inspector-path-segments` line layer driven by `['get', 'color']`.
  - To prevent clashing and distinguish the chosen route from alternatives:
    - Set the chosen route's `line-width` to `6` and `line-opacity` to `1.0`.
    - Set the alternative routes' `line-width` to `4`, `line-opacity` to `0.6`, and possibly add a subtle `line-dasharray`.
- [ ] **Task 2: Always-Visible Symbols Layer**
  - _Details_: Add an `inspector-node-symbols` layer in `InspectorLayer.tsx` to render traffic lights and stop signs directly on the route.
  - _Clash Prevention_: Use `text-field` with emojis (e.g., 🛑, 🚦, ⚠️). Set `text-allow-overlap: false` and `text-ignore-placement: false` so MapLibre's collision engine automatically hides overlapping icons when zoomed out, preventing map clutter.
- [ ] **Task 3: Turn Direction Cues**
  - _Details_: Add an `inspector-turn-arrows` symbol layer. Use `icon-image` (or text arrows) with `icon-rotate: ['get', 'bearing']` and `symbol-placement: line` to place arrows pointing in the direction of sharp turns.

### Milestone 4: Inspector Panel UI Updates

_Focus: Anchoring the new visual language in the sidebar._

- [ ] **Task 1: Persistent Map Legend**
  - _Details_: Add a permanent legend to `src/components/InspectorPanel.tsx` while in inspector mode. It must clearly explain the colors (Green, Blue, Red, Purple) and the icons (🛑, 🚦) so users instantly understand the map without clicking.
- [ ] **Task 2: Segment Breakdown in Details Card**
  - _Details_: When a user _does_ click an intersection to inspect it, the alternative routes popup should echo this visual language. Render a small color swatch next to each segment in the list of evaluated edges to reinforce the color-to-infrastructure mapping.

## 📝 Notes & Open Questions

- **Performance**: We will be mapping potentially hundreds of line segments and points into GeoJSON on the fly. We should ensure this mapping is memoized in a React hook (`useInspectorGeoJSON()`) so we don't block the main thread on every re-render.
- **Alternative Overlap**: Alternative paths often share identical segments with the chosen path. We must ensure the chosen path is rendered _on top_ of the alternatives (via layer z-index order) so its full opacity color is visible.
