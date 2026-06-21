# Plan: Directional Turn Penalties and Custom Turn Overrides

## 🎯 Objective

Split the uniform turn penalty into directional defaults (e.g., left vs. right turns) to accurately reflect real-world yielding priorities, and introduce a semantic turn configuration schema to allow intersection-specific maneuver overrides.

## 🗺️ Milestones

### Milestone 1: Configuration Schema and Defaults

_Focus: Define the types and default values for directional turn penalties and semantic overrides._

- [x] **Task 1: Update Configuration Types**
  - _Details_: In `src/core/router/types.ts`, introduce a `TurnRuleConfig` type containing properties like `rightTurnPenaltySeconds`, `leftTurnPenaltySeconds`, `greenArrowRightTurnSeconds`, and `indirectLeftTurnSeconds`. Add a `turns` property of this type to `RulesConfiguration`. Update the generic `nodeTurns` override map (in `src/core/storage/types.ts` and elsewhere) to use a strict type instead of `Record<string, unknown>`.
- [x] **Task 2: Implement Defaults**
  - _Details_: Update `DEFAULT_RULES_CONFIG` in `src/core/router/rules.ts` to provide reasonable defaults for the new `turns` section (e.g., left turn = 4s, right turn = 1s, U-turn = 30s). Adjust `useOverrides.ts` to ensure backwards compatibility when merging existing user configuration.

### Milestone 2: Asymmetric Turn Penalty Logic

_Focus: Update the core routing engine to differentiate between left and right turns._

- [x] **Task 1: Update Geometry Logic**
  - _Details_: In `src/core/common/geometry.ts`, modify `calculateTurnPenalty` to accept the new `turns` config or return a direction object so the router can apply the correct penalty. Leverage the cross-product calculation (already present in `getTurnDetails`) to correctly identify left vs. right turns.
- [x] **Task 2: Integrate into Router**
  - _Details_: Update `router.ts` and `cost.ts` to utilize the new directional logic. Ensure that when a standard turn occurs, the appropriate default left or right turn penalty from `rulesConfig` is applied, replacing the old hardcoded `NORMAL_TURN_PENALTY_SECONDS`.

### Milestone 3: Semantic Turn Overrides

_Focus: Allow specific intersections to override standard turn penalties based on user configuration._

- [x] **Task 1: Apply Custom Turn Overrides during Routing**
  - _Details_: In `router.ts` (`runDijkstra` and `buildRouteStatistics`), inspect the `overrides.nodeTurns` map when traversing a node. Use a composite key like `${parentNodeId}->${nextNodeId}` to detect if the user has defined a semantic override (e.g., "Free Right Turn") for the maneuver at `currentNode`.
- [x] **Task 2: Evaluate Override Costs**
  - _Details_: If an override is found, map the semantic turn type to its corresponding configured penalty in `rulesConfig.turns` and apply it in place of the default turn penalty.

## 📝 Notes & Open Questions

- **Backward Compatibility**: Ensure `useOverrides.ts` gracefully handles legacy `rulesConfig` objects saved in local storage without breaking the app.
- **UI Integration**: This plan focuses primarily on the algorithm and data structures. Building the UI to interactively set `nodeTurns` on map clicks will likely be handled in a follow-up feature, but the data structures must be ready for it.
