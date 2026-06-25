# Amend 2 Plan: Inspector Mode Interaction & Click Interception Fix

## 🎯 Objective

Resolve the click interception issue where invisible Global Route Strategies steal click events from Inspector nodes. Ensure that when Inspector Mode is active, Global Route Strategies are completely disabled—both visually and interactively—so that "Local Node Alternatives" can be correctly selected.

## 🧐 The Misunderstanding

In the previous amendment, we noted that the Global Route Strategies (Standard, Avoid Stops, Quiet) should be visually hidden (opacity `0.0`). However, in MapLibre GL JS, setting `line-opacity` to `0.0` makes a layer transparent, but **it still receives pointer events (clicks)**.

Because the transparent Global Route Strategy lines are thick and sit above or near the interactive blue inspector nodes, they intercept the click events. Consequently, clicking on an inspector node triggers a change in the Global Route Strategy instead of selecting the "Local Node Alternative" to inspect.

## 🗺️ Milestones

### Milestone 1: Completely Disable Global Strategies in Inspector Mode

_Focus: Prevent transparent layers from stealing map clicks._

- [ ] **Task 1: Toggle Layer Visibility**
  - _Details_: In `src/components/map/RouteAlternativesLayer.tsx`, update the `layout` property of the `route-path-layer-*` and `route-path-glow-*` layers. Use the `visibility` property: `visibility: isInspectorModeActive ? 'none' : 'visible'`. This completely removes the layers from the interaction rendering pass, ensuring they cannot be clicked.
- [ ] **Task 2: Disable Click Handlers**
  - _Details_: In the `onClick` event listeners inside `RouteAlternativesLayer.tsx` (e.g., `handleStandardClick`), add an early return: `if (isInspectorModeActive) return;`. This provides an extra layer of protection against rogue event propagation.
- [ ] **Task 3: Disable Cursor Changes**
  - _Details_: Similarly, update the `mouseenter` and `mouseleave` handlers for the Global Route Strategies to abort and prevent changing the cursor to a `pointer` if `isInspectorModeActive` is true.

## 📝 Expected Interaction Flow

1. User activates Inspector Mode.
2. The Global Route Strategies are set to `visibility: 'none'`.
3. The user hovers over an interactive blue node. Only the `inspector-nodes-layer` triggers a pointer cursor change.
4. The user clicks the blue node. Because the Global Route Strategy layers are non-visible/disabled, the click correctly hits the node.
5. The `InspectorLayer.tsx` processes the click, sets the `selectedNodeId`, and displays the Local Node Alternatives without interference.
