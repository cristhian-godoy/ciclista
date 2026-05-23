# German Traffic Signs & Rules Checklist

## Phase 1: UI & Configuration State
- [x] **Bite 1.1: Core Types definition**
  - [x] Add `GermanSign` enum in `src/core/types.ts`
  - [x] Add `RoadType` enum in `src/core/types.ts`
  - [x] Add `SignRuleConfig` and `RoadRuleConfig` types
  - [x] Add `RulesConfiguration` interface
- [x] **Bite 1.2: Settings Panel UI**
  - [x] Create `src/components/RulesConfigPanel.tsx` component
  - [x] Render configuration input ranges and dismount toggles
- [x] **Bite 1.3: Sidebar & Main App Integration**
  - [x] Render `RulesConfigPanel` in `src/components/Sidebar.tsx`
  - [x] Set up configuration state and handler in `src/App.tsx`
- [x] **Bite 1.4: Persistence in Storage**
  - [x] Extend storage module in `src/core/storage/storage.ts` to save/load rule configs
  - [x] Load persisted rules on page startup

## Phase 2: Rules Mapping Engine
- [x] **Bite 2.1: Mapping logic**
  - [x] Create `src/core/router/rules.ts`
  - [x] Implement `mapOSMToSignAndRoad` function
- [x] **Bite 2.2: Unit tests**
  - [x] Create `src/core/router/rules.test.ts`
  - [x] Add test cases for various OSM way tag combinations (19 tests, all passing)

## Phase 3: Cost Engine Integration
- [x] **Bite 3.1: Pass configuration to Routing Engine**
  - [x] Thread `rulesConfig` through `LocalOverrides` to all `CostFunction` calls
  - [x] `rulesConfig` included in `currentOverrides` memo in `src/core/router/router.ts`
- [x] **Bite 3.2: Refactor Costing Calculation**
  - [x] Refactor `standardCost` in `src/core/router/cost.ts` to resolve speed and penalties dynamically
- [x] **Bite 3.3: Refactor alternate routing cost functions**
  - [x] Refactor `avoidStoppingCost` and `avoidBusyRoadsCost`

## Phase 4: Debug Visibility & Verification
- [x] **Bite 4.1: Edge Details Debug View**
  - [x] Save matched sign/road metadata to routing edge result objects
  - [x] Display matched traffic signs next to edge names in Sidebar debug list view
- [x] **Bite 4.2: E2E manual testing**
  - [x] Panel appears, sections expand, sliders react route in real time
  - [x] Debug badges (Vz_xxx purple / road-class blue) visible on all edges
  - [x] Settings persist across hard reload
  - [x] Reset button restores defaults
