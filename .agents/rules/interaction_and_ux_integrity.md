# Rule: Interaction Contexts, Mode Lifecycles, and Spatial UX Integrity

## Activation
- **Always On**

## Guidelines

1. **Explicit Mode & Sub-State Lifecycle**:
   - **Mode Isolation**: Application modes (`routing`, `places`, `events`/`studio`, `edit`, and `navigation`) must be mutually deterministic. Features active in one mode must not leak handlers, cursors, or transient state into another mode.
   - **Sub-State Teardown**: Interactive tools and transient sub-states (pin placement, radius brush, active node selection, inspection overlays, context menus) must automatically tear down and reset when switching modes.
   - **Escape Key Contract**: Every active modal, context menu, pin placement mode, or interactive drawing/selection tool must listen for the `Escape` key to abort or dismiss cleanly to the base mode state.
   - **Pointer & Gesture Integrity**: Canvas event handlers (`click`, `contextmenu`, `mousedown`, `mousemove`) in `useMapInteractionController` and `useMapGestures` must evaluate the active mode first. Suppress background pan/drag conflicts during brush operations, and restore map interactions deterministically on gesture completion or mode unmount.

2. **Map-First Spatial Interaction**:
   - **Direct Map Manipulation**: Spatial entities (route endpoints, intermediate waypoints, places, event zones, road blocks) must support direct map canvas interaction as their primary input pattern. Users must not be required to manually type raw coordinates (`lat, lng`) into text inputs to create or position spatial entities.
   - **Placement Feedback**: When initiating entity creation from panels or buttons, the UI must enter a guided map placement mode with clear visual feedback (custom cursor, instruction toast/banner) that commits on the next canvas click.
   - **Marker Draggability**: Spatial pin markers placed on the map must be draggable (`dragend` synchronization to parent state) unless explicitly locked during active turn-by-turn navigation or read-only mode.
   - **Secondary Coordinate Display**: Text coordinate inputs are strictly secondary display and manual override controls, and must parse and validate coordinates defensively before updating domain state. Never populate spatial state with dummy origins (such as `{ lat: 0, lng: 0 }`).

3. **Surface Integration Checklist**:
   - Whenever introducing or refactoring a spatial feature or application workflow, verify its integration across all core interaction surfaces:
     - **Canvas Left-Click**: Define explicit click behavior per active mode in `useMapInteractionController`. Ensure priority ordering (e.g. active placement sub-mode -> domain features -> edge selection -> route endpoints) is unambiguous.
     - **Canvas Right-Click Context Menu**: Evaluate whether the feature belongs in `MapContextMenu`. Only expose actions that are spatially relevant and context-appropriate to the active mode. Never display actions for inactive modes or clutter the menu during turn-by-turn navigation or specialized editing modes.
     - **Marker Drag Interactions**: Ensure all draggable markers on the map canvas register `dragstart` / `dragend` callbacks and update corresponding state coordinates without race conditions or map drag collisions.
     - **Empty & Disabled States**: Actions with unmet preconditions (such as adding intermediate stops when endpoints do not exist) must either remain disabled with explanatory tooltips or explicitly initiate the prerequisite guided interaction flow. Never leave buttons clickable if executing them triggers invalid state, infinite loops, or runtime errors.
     - **URL & Storage Synchronization**: Spatial state mutations must be synchronized with URL query parameters and local storage using debounce and bounds-check safeguards to prevent desynchronization or navigation thrashing.
