# German Traffic Signs & Rules - Incremental Roadmap

This plan breaks down the integration of German road rules, signs, and classifications into small, testable, and reversible bites. We implement the UI configuration panel first, followed by the local state management and persistence, then the mapping layer, and finally the routing cost engine integration.

---

## Proposed Changes

### Phase 1: UI & Configuration State (Small Bites)

#### Bite 1.1: Core Types definition in [types.ts](file:///home/cgodoy/work/ciclista/src/core/types.ts)
Define the configurations for traffic signs and road classifications:
- Define `GermanSign` enum representing signs: Vz 242.1 (Pedestrian Zone), Vz 239 (Sidewalk), Vz 240 (Shared Path), Vz 241 (Segregated Path), Vz 325.1 (Living Street), Vz 244.1 (Bicycle Street).
- Define `RoadType` enum representing classifications: Primary, Secondary, Residential, Service, Path (Default).
- Define `SignRuleConfig` and `RoadRuleConfig` structures (speed limit km/h, flat penalty seconds, and dismount required).
- Define the global `RulesConfiguration` structure.

#### Bite 1.2: Settings Panel UI [RulesConfigPanel.tsx](file:///home/cgodoy/work/ciclista/src/components/RulesConfigPanel.tsx) [NEW]
Create a custom React settings component:
- Render input ranges (sliders) for base speeds and flat penalties.
- Add checkbox toggles for dismount requirements.
- Divide configurations into two clean collapsible sections: "German Traffic Signs" and "Road Classifications".

#### Bite 1.3: Sidebar & Main App Integration
- Add collapsible container for the rules configuration inside [Sidebar.tsx](file:///home/cgodoy/work/ciclista/src/components/Sidebar.tsx).
- Manage the configuration state using standard React `useState` in [App.tsx](file:///home/cgodoy/work/ciclista/src/App.tsx) and pass state and updates down.

#### Bite 1.4: Persistence in Storage [storage.ts](file:///home/cgodoy/work/ciclista/src/core/storage/storage.ts)
- Extend `LocalStorageProvider` to save and load `RulesConfiguration` state from browser localStorage.

---

### Phase 2: Rules Mapping Engine (Small Bites)

#### Bite 2.1: Mapping logic in [rules.ts](file:///home/cgodoy/work/ciclista/src/core/router/rules.ts) [NEW]
Implement the tag parser matching OSM attributes to signs or road types:
- Implement `mapOSMToSignAndRoad(highway: string, tags: Record<string, string>)`.
- Detect "Fahrräder frei" supplementary signs based on `bicycle=yes` or `bicycle=designated` tags on footways/pedestrian segments.

#### Bite 2.2: Unit tests in `src/core/router/rules.test.ts` [NEW]
- Create unit tests verifying various OSM way tag combinations map to the correct German traffic sign or road classification.

---

### Phase 3: Cost Engine Integration (Small Bites)

#### Bite 3.1: Pass configuration to Routing Engine
- Update `CostFunction` signature to accept `rulesConfig: RulesConfiguration`.
- Adjust Dijkstra router's call references to pass the configuration during route traversal.

#### Bite 3.2: Refactor Costing Calculation in [cost.ts](file:///home/cgodoy/work/ciclista/src/core/router/cost.ts)
- Replace hardcoded speed estimation (`getBaseSpeed`) and flat penalties in `standardCost` with calculations resolved dynamically through the mapped `GermanSign` or `RoadType` configurations.
- Include supplementary sign multipliers (e.g. Schrittgeschwindigkeit speed caps).

#### Bite 3.3: Refactor alternate routing cost functions
- Update `avoidStoppingCost` and `avoidBusyRoadsCost` strategies to integrate dynamically with the rules configuration.

---

### Phase 4: Debug Visibility & Verification (Small Bites)

#### Bite 4.1: Edge Details Debug View
- Extend the route result data structure to store matched signs/rules per traversed edge.
- Display the matched German road sign code (e.g. "[Vz 242.1]") or road type in the "Debug Route Edges" list item view in [Sidebar.tsx](file:///home/cgodoy/work/ciclista/src/components/Sidebar.tsx).

#### Bite 4.2: End-to-End manual testing
- Tweak rules settings (e.g., set Pedestrian Zone flat penalty to `500s`) and verify that routing updates dynamically and recalculates in < 15ms.

---

## Verification Plan

### Automated Tests
- Run `npm run lint` and `npm run build` to verify compile clean state.
- Add and run vitest unit tests for the mapping rules.

### Manual Verification
- Render the local server, verify that the configuration panel is fully interactive, values persist on reload, and map pathing updates dynamically upon slider adjustments.
