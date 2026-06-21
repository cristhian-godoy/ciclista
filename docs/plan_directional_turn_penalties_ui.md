# Plan: Directional Turn Penalties - UI & Configuration

## 🎯 Objective

Build the user interface for configuring global directional turn penalties and enable map-based, intersection-specific semantic turn overrides (e.g., "Free Right Turn" or "Indirect Left").

## 🗺️ Milestones

### Milestone 1: Global Rules Configuration UI

_Focus: Extend the existing `RulesConfigPanel` to support the new `turns` schema._

- [ ] **Task 1: Add Turns Configuration Section**
  - _Details_: In `src/components/RulesConfigPanel.tsx`, create a new expandable section for "Turn Penalties".
- [ ] **Task 2: Implement Input Fields**
  - _Details_: Add number input fields bound to `rulesConfig.turns` (e.g., Left Turn Penalty, Right Turn Penalty, Green Arrow Right Turn, Indirect Left Turn). Ensure changes correctly propagate to `onChange` and save to local storage.

### Milestone 2: Intersection Map Interaction

_Focus: Enable users to select specific maneuvers at an intersection to apply semantic overrides._

- [x] **Task 1: Enhance Node Click / Popup**
  - _Details_: In `src/components/map/NodePopup.tsx` (or an equivalent map interaction layer), detect when an intersection node is clicked and retrieve all connected edges (streets).
- [x] **Task 2: Build Maneuver Selector UI**
  - _Details_: Display a list of possible maneuvers through the intersection (e.g., "From Leopoldstraße (Northbound) To Franz-Joseph-Straße (Westbound - Left Turn)").

### Milestone 3: Semantic Turn Dropdowns

_Focus: Allow users to assign specific override types to selected maneuvers._

- [x] **Task 1: Implement Dropdown Selectors**
  - _Details_: Next to each detected maneuver in the popup, add a `<select>` dropdown containing the semantic turn types defined in the core types (e.g., "Default", "Direct Left Turn", "Indirect Left Turn", "Free Right Turn").
- [x] **Task 2: Save nodeTurns Overrides**
  - _Details_: When a semantic turn type is selected, update the global `overrides.nodeTurns` state using `useOverrides` hook logic. Store the override using the format `nodeTurns.set(nodeId, { [fromNodeId_toNodeId]: semanticValue })`.

## 📝 Notes & Open Questions

- **Edge Identification**: Determining "Northbound" or "Westbound" dynamically for the UI requires calculating bearings from the node coordinates.
- **Visual Feedback**: How do we visually indicate on the map that an intersection has a custom turn override applied? (Consider rendering a small icon or badge over overridden intersections).
