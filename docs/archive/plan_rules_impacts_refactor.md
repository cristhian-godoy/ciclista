# Plan: Rules Configuration → Impacts Mapping Layer

## 🎯 Objective

Decouple `RulesConfiguration` (user-facing, UI/storage) from algorithm-facing types by introducing resolved impact types and pure mapping functions — mirroring the existing `BikeConfig → mapBikeConfigToImpacts() → RouterBikeImpacts` pattern. This eliminates speed-type interpretation logic from the hot cost-calculation path and cleanly separates UI metadata (`name`, `description`, `iconCode`) from algorithm numerics.

## 🗺️ Milestones

### Milestone 1: Define Decoupled Impact Types

_Focus: Create the algorithm-facing types that cost functions will consume instead of reading `RulesConfiguration` directly._

- [x] **Create `ResolvedEdgeImpact` interface**: The resolved output for a single sign or road rule. Contains only what the algorithm needs.
  - _File_: `src/core/router/types.ts` (alongside existing `SignRuleConfig`, `RoadRuleConfig`)
  - _Shape_:
    ```ts
    interface ResolvedEdgeImpact {
      effectiveSpeedMs: number;
      flatPenaltySeconds: number;
      comfort: ComfortLevel;
    }
    ```
  - `effectiveSpeedMs` is the fully resolved speed in m/s (no more `speedType` interpretation at cost-calculation time).
  - `comfort` defaults to `'neutral'` if unset in the source config.

- [x] **Create `RouterSignImpacts` type alias**: A `Record<InfrastructureType, ResolvedEdgeImpact>` mapping each infrastructure concept to its resolved impact.
  - _File_: `src/core/router/types.ts`
  - _Shape_: `type RouterSignImpacts = Record<InfrastructureType, ResolvedEdgeImpact>;`

- [x] **Create `RouterRoadImpacts` type alias**: A `Record<RoadType, ResolvedEdgeImpact>` mapping each road classification to its resolved impact.
  - _File_: `src/core/router/types.ts`
  - _Shape_: `type RouterRoadImpacts = Record<RoadType, ResolvedEdgeImpact>;`

- [x] **`NodeDelayConfig` — no change needed**: It already contains resolved numerical seconds with no interpretation layer. Document this decision with a brief comment in `types.ts` noting it already serves as both user-config and algorithm-impact.

---

### Milestone 2: Create Mapping Functions

_Focus: Pure functions that transform user-facing config → algorithm-facing impacts. New file parallel to `bike.ts`._

- [x] **Create `src/core/router/rules-impacts.ts`** (new file): Houses all mapping functions. Follows the `bike.ts` convention of co-locating impact types re-exports and mappers.

- [x] **Implement `resolveSignImpact(cfg: SignRuleConfig, cruisingSpeedKmh: number): ResolvedEdgeImpact`**: Resolves a single sign rule config into its algorithm impact.
  - _Internal logic_: Use `getEffectiveSignSpeedType(cfg)` from `rules.ts` to determine the speed type, then resolve to actual speed using the same `speedType → km/h` switch logic currently in `resolveRuleSpeed()` (cost.ts L52-64). Convert to m/s via `kmh / 3.6`. Default `comfort` to `'neutral'`.
  - _Key_: This function replaces the sign-specific branch of `resolveRuleSpeed()` in cost.ts. It reuses `getEffectiveSignSpeedType()` from rules.ts rather than duplicating the fallback logic that `resolveRuleSpeed()` currently has inline (cost.ts L32-49).

- [x] **Implement `resolveRoadImpact(cfg: RoadRuleConfig, cruisingSpeedKmh: number): ResolvedEdgeImpact`**: Resolves a single road rule config into its algorithm impact.
  - _Internal logic_: Use `getEffectiveRoadSpeedType(cfg)` from `rules.ts`, then the same `speedType → km/h` switch, convert to m/s. Default `comfort` to `'neutral'`.

- [x] **Implement `mapSignConfigToImpacts(signs, cruisingSpeedKmh): RouterSignImpacts`**: Bulk mapper iterating `Record<InfrastructureType, SignRuleConfig>` and calling `resolveSignImpact()` per entry.
  - _Signature_: `(signs: Record<InfrastructureType, SignRuleConfig>, cruisingSpeedKmh: number) => RouterSignImpacts`

- [x] **Implement `mapRoadConfigToImpacts(roads, cruisingSpeedKmh): RouterRoadImpacts`**: Bulk mapper iterating `Record<RoadType, RoadRuleConfig>` and calling `resolveRoadImpact()` per entry.
  - _Signature_: `(roads: Record<RoadType, RoadRuleConfig>, cruisingSpeedKmh: number) => RouterRoadImpacts`

- [x] **Helper: `resolveSpeedTypeToMs(speedType, baseSpeedKmh, cruisingSpeedKmh): number`**: Private helper shared by both `resolveSignImpact` and `resolveRoadImpact`.
  - Absorbs the `switch(speedType)` logic from `resolveRuleSpeed()` (cost.ts L52-64) and converts the result to m/s in one step.
  - _Logic_:
    ```
    relative → cruisingSpeedKmh / 3.6
    slow     → 15 / 3.6
    slower   → 10 / 3.6
    dismount → 4 / 3.6
    custom   → baseSpeedKmh / 3.6
    ```

---

### Milestone 3: Refactor `cost.ts` to Consume Impacts

_Focus: Replace inline `RulesConfiguration` reads and `resolveRuleSpeed()` calls with impact lookups._

- [x] **Refactor `resolveSpeedAndPenalty()`** (cost.ts L71-135): Replace the `rules.signs[sign]` / `rules.roads[road]` branches (L84-98) with resolved impact lookups.
  - _Before_: Reads `SignRuleConfig` / `RoadRuleConfig`, calls `resolveRuleSpeed(cfg, impacts.cruisingSpeedKmh)`, takes `cfg.flatPenaltySeconds`.
  - _After_: Compute `RouterSignImpacts` and `RouterRoadImpacts` via the new bulk mappers (using `bikeImpacts.cruisingSpeedKmh`). Look up `signImpacts[sign]` or `roadImpacts[road]` → read `effectiveSpeedMs` and `flatPenaltySeconds` directly. No `resolveRuleSpeed()` call.
  - _Fallback path_ (L99-122, when `rules` is undefined): Remains unchanged — hardcoded fallback logic stays.
  - _Constraint_: Output values (speed, flatPenalty) must be numerically identical to preserve existing test expectations.

- [x] **Refactor `avoidBusyRoadsCost()` comfort resolution** (cost.ts L264-289): Replace direct `rules.signs[sign].comfort` / `rules.roads[road].comfort` reads with `signImpacts[sign].comfort` / `roadImpacts[road].comfort`.
  - _Before_: `comfort = rules.signs[sign].comfort || 'neutral'` (L270-273).
  - _After_: `comfort = signImpacts[sign].comfort` (already defaulted to `'neutral'` by the mapping function).
  - _Constraint_: The cycleway comfort override (L292-295) and fallback logic (L275-289) remain unchanged.

- [x] **Remove `resolveRuleSpeed()` export from `cost.ts`**: The function is fully replaced by `resolveSignImpact()` / `resolveRoadImpact()` in `rules-impacts.ts`. Delete the function definition (cost.ts L26-65) and remove it from exports.
  - _Note_: The duplicated fallback logic (cost.ts L32-49) that determines speedType for signs is already properly handled by `getEffectiveSignSpeedType()` in rules.ts — the new mapping functions use that, eliminating the duplication.

---

### Milestone 4: Unit Tests

_Focus: Test the new mapping functions and migrate existing tests._

- [x] **Create `src/core/router/rules-impacts.test.ts`** (new file): Unit tests for the mapping functions.
  - Test `resolveSignImpact()` for each `InfrastructureType` with default `speedType` values and verify `effectiveSpeedMs`, `flatPenaltySeconds`, `comfort` match expectations.
  - Test `resolveRoadImpact()` for each `RoadType`.
  - Test with varying `cruisingSpeedKmh` (15, 18, 25, 30) to verify `relative` speed type tracks cruising speed.
  - Test `speedType` overrides: explicit `slow`, `slower`, `dismount`, `custom` on a sign config.
  - Test comfort defaults to `'neutral'` when absent in source config.
  - Test bulk `mapSignConfigToImpacts()` and `mapRoadConfigToImpacts()` produce complete records.
  - Test with `DEFAULT_RULES_CONFIG` from rules.ts as a realistic integration-style input.

- [x] **Migrate `resolveRuleSpeed` tests from `cost.test.ts`**: The `describe('resolveRuleSpeed', ...)` block (cost.test.ts L17-83) tests speed resolution logic. This logic now lives in the mapping functions.
  - Rewrite these as `resolveSignImpact` / `resolveRoadImpact` tests in the new test file, asserting on `effectiveSpeedMs` (converted from km/h expectations: multiply old expected km/h by `1/3.6`).
  - Remove the `resolveRuleSpeed` describe block and import from `cost.test.ts`.

- [x] **Verify all existing tests pass unchanged**: `cost.test.ts`, `rules.test.ts`, `router.test.ts`. The refactor must not change any observable cost calculation output.
  - Run: `npx vitest run src/core/router/`

---

### Milestone 5: Cleanup

_Focus: Update `.info` files and remove dead code._

- [x] **Update `.info` for `src/core/router/`**: Add description for the new `rules-impacts.ts` and `rules-impacts.test.ts` files.
  - Follow existing `.info` format in the repository.

- [x] **Verify no dead imports**: Confirm `resolveRuleSpeed` is no longer imported anywhere. Confirm `SignRuleConfig` / `RoadRuleConfig` are no longer imported in `cost.ts` (they should only be needed by the mapping layer and the UI now).

## 📝 Notes & Open Questions

- **Composition dependency**: `RouterSignImpacts` / `RouterRoadImpacts` depend on `RouterBikeImpacts.cruisingSpeedKmh` because `speedType: 'relative'` resolves to the bike's cruising speed. The mapping functions take `cruisingSpeedKmh` as a parameter. This means whenever `BikeConfig` changes, rules impacts must also be recomputed. Currently this is fine because both are resolved per-call inside `resolveSpeedAndPenalty()`, but a future optimization (computing impacts once per routing request rather than per-edge) would need to respect this dependency.

- **`NodeDelayConfig` is already concrete**: Its values are raw seconds with no interpretation. No mapping layer needed. If future UX changes introduce abstract delay presets (e.g., "lenient" / "strict"), a mapping layer can be added then.

- **`getEffectiveSignSpeedType()` / `getEffectiveRoadSpeedType()` stay in `rules.ts`**: They serve the UI (used by `RulesRows.tsx` for display). The new mapping functions in `rules-impacts.ts` reuse them internally.

- **Hardcoded fallback path in `resolveSpeedAndPenalty()`** (cost.ts L99-122): This path handles the case when `rulesConfig` is undefined. It uses hardcoded speeds that don't follow the rules pattern. This is out of scope for this refactor but could be a future milestone (providing a mandatory default `RulesConfiguration` so the fallback path can be removed).
