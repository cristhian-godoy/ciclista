# Plan: Interactive Inspector Mode Refinements (Part 2)

## 🎯 Objective

Refine the interactive inspector mode implementation to display explicit road rule penalties in the sidebar and hover popups, allow selecting and locking a specific alternative path for downstream comparison, and ensure clean layer and node visibility.

## 🗺️ Milestones

### Milestone 1: Surface Explicit Road Rules in popups and sidebar (Addresses point 6)

_Focus: Replace hardcoded penalty labels with dynamic iteration over the `rulePenalties` array in both the Inspector panel and map hover popups._

- [x] **Task 1: Update InspectorPanel to iterate over rulePenalties**
  - _Details_: Modify `InspectorPanel.tsx` to dynamically map and render the items from `ev.rulePenalties` rather than rendering hardcoded conditional fields. Display their exact names and values (e.g. "Left Turn Penalty: +3s", "Stop Sign Delay: +8s").
- [x] **Task 2: Add rulePenalties to Map Hover Popups**
  - _Details_: Modify `InspectorLayer.tsx` hover popup layout to display a list of active `rulePenalties` for the hovered edge/alternative. Show details such as turn direction, road classes, or specific signal delays.

### Milestone 2: Interactive Alternative Path Selection & Highlighting (Addresses point 4)

_Focus: Support selecting a different path from an inspected node, showing its full downstream path overlay and locking the comparison metrics._

- [x] **Task 1: Introduce selectedAlternativeTargetId state**
  - _Details_: Update `useInspectorMode.ts` and `MapContext.tsx` to expose `selectedAlternativeTargetId` and its setter. Reset it when `selectedNodeId` changes or inspector mode is deactivated.
- [x] **Task 2: Select/Lock Alternative from Sidebar or Map**
  - _Details_: Allow clicking alternative edges on the map (updating `selectedAlternativeTargetId` on click) or clicking a button/card in the `InspectorPanel.tsx`. Highlight the active/locked alternative card in the sidebar.
- [x] **Task 3: Dynamic Path Rendering on Map (Hover vs Locked)**
  - _Details_: In `InspectorLayer.tsx`, separate the rendering:
    - Draw immediate alternative outgoing edges (first segment only) as clean solid lines.
    - When hovering over an alternative, render its full downstream path as a thick dashed line and show the comparative popup.
    - When an alternative is selected/locked, render its full downstream path as a persistent highlighted path (solid line) on the map.
- [x] **Task 4: Persistent Comparison UI**
  - _Details_: When an alternative is locked, display a comparison card in `InspectorPanel.tsx` comparing the chosen remaining path against the selected alternative path in terms of Time, Distance, and Signals (e.g., "+45s, +120m, +1 signal").

### Milestone 3: Clean UI Layer Management (Addresses points 2 & 5)

_Focus: Verify correct visibility behaviors for inactive layers and node/edge filtering._

- [x] **Task 1: Verify Node Filtering & U-Turns**
  - _Details_: Verify that interactive nodes with zero outgoing choices (excluding the chosen and backwards/U-turn edges) are hidden, and that backward/U-turn edges are completely omitted from evaluations.
- [x] **Task 2: Verify Inactive Route Visibility**
  - _Details_: Verify that non-active global routing strategies (e.g. quiet-streets, avoid-stops) are set to opacity `0.0` when inspector mode is active.

## 📝 Notes & Open Questions

- **Performance**: Downstream projections are precomputed in the router worker, which avoids performance issues during map interactions.
- **UI/UX Consistency**: Ensure all new popup layouts and comparison cards fit the glassmorphic styling conventions.
