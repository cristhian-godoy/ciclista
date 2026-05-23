# German Traffic Signs & Rules Task List

## Research & Architecture Planning
- [x] Analyze current `cost.ts` logic and identify OSM-to-rules boundaries
- [x] Create Implementation Plan and align on sign configurations

## Logic Implementation
- [ ] Create `src/core/router/rules.ts` with sign enum, mapping function, and type definitions
- [ ] Refactor `src/core/router/cost.ts` to fetch rules weights from overrides instead of hardcoded numbers
- [ ] Update route debug details in `src/core/types.ts` to include Sign metadata on matched edges
- [ ] Add unit tests under `src/core/router/rules.test.ts`

## UI Development
- [ ] Implement `src/components/RulesConfigPanel.tsx` UI settings widget
- [ ] Integrate configuration panel in `src/components/Sidebar.tsx`
- [ ] Display matched sign classifications in "Debug Route Edges" list item view

## Verification & Polish
- [ ] Run typescript compiler and eslint checks to verify clean state
- [ ] Verify routing updates dynamically when configuring settings in the UI
