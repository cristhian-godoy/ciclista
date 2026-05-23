# German Traffic Signs & Rules Checklist

## Phase 1: UI & Configuration State
- [ ] **Bite 1.1: Core Types definition**
  - [ ] Add `GermanSign` enum in `src/core/types.ts`
  - [ ] Add `RoadType` enum in `src/core/types.ts`
  - [ ] Add `SignRuleConfig` and `RoadRuleConfig` types
  - [ ] Add `RulesConfiguration` interface
- [ ] **Bite 1.2: Settings Panel UI**
  - [ ] Create `src/components/RulesConfigPanel.tsx` component
  - [ ] Render configuration input ranges and dismount toggles
- [ ] **Bite 1.3: Sidebar & Main App Integration**
  - [ ] Render `RulesConfigPanel` in `src/components/Sidebar.tsx`
  - [ ] Set up configuration state and handler in `src/App.tsx`
- [ ] **Bite 1.4: Persistence in Storage**
  - [ ] Extend storage module in `src/core/storage/storage.ts` to save/load rule configs
  - [ ] Load persisted rules on page startup

## Phase 2: Rules Mapping Engine
- [ ] **Bite 2.1: Mapping logic**
  - [ ] Create `src/core/router/rules.ts`
  - [ ] Implement `mapOSMToSignAndRoad` function
- [ ] **Bite 2.2: Unit tests**
  - [ ] Create `src/core/router/rules.test.ts`
  - [ ] Add test cases for various OSM way tag combinations

## Phase 3: Cost Engine Integration
- [ ] **Bite 3.1: Pass configuration to Routing Engine**
  - [ ] Update `CostFunction` signature in `src/core/types.ts`
  - [ ] Update Dijkstra dynamic cost calls in `src/core/router/router.ts`
- [ ] **Bite 3.2: Refactor Costing Calculation**
  - [ ] Refactor `standardCost` in `src/core/router/cost.ts` to evaluate speed and penalties dynamically
- [ ] **Bite 3.3: Refactor alternate routing cost functions**
  - [ ] Refactor `avoidStoppingCost` and `avoidBusyRoadsCost`

## Phase 4: Debug Visibility & Verification
- [ ] **Bite 4.1: Edge Details Debug View**
  - [ ] Save matched sign/road metadata to routing edge result objects
  - [ ] Display matched traffic signs next to edge names in Sidebar debug list view
- [ ] **Bite 4.2: E2E manual testing**
  - [ ] Tweak rules in settings and verify path adjustments
