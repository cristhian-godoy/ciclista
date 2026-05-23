# German Traffic Signs & Rules Integration

Align the route planner costing algorithm with German traffic signs and rules (e.g., pedestrian zones, shared sidewalks, living streets, bicycle streets). Introduce a transparent mapping layer between raw OpenStreetMap (OSM) tags and German road signs, along with a configuration interface in the UI.

## User Review Required

> [!IMPORTANT]
> **Configurable Rules & Defaults**:
> We propose mapping OSM segments to specific German traffic signs and allowing the user to customize the speeds and penalties for each sign in a new settings panel. 
> Here are the proposed signs and their default configurations:
> - **Sign 242.1 (Pedestrian Zone)**:
>   - *No supplementary sign*: Dismount required. Speed: `4 km/h`. Penalty: `120s`.
>   - *With "Fahrräder frei"*: Allowed to ride. Speed: `8 km/h` (Schrittgeschwindigkeit). Penalty: `30s`.
> - **Sign 239 (Sidewalk/Gehweg)**:
>   - *No supplementary sign*: Dismount required. Speed: `4 km/h`. Penalty: `120s`.
>   - *With "Fahrräder frei"*: Allowed to ride. Speed: `8 km/h`. Penalty: `20s`.
> - **Sign 240 (Shared Pedestrian & Cycle Path)**:
>   - Allowed to ride. Speed: `14 km/h`. Penalty: `5s` (due to potential yield conflicts).
> - **Sign 241 (Segregated Pedestrian & Cycle Path)**:
>   - Allowed to ride. Speed: `18 km/h`. Penalty: `0s`.
> - **Sign 325.1 (Living Street / Verkehrsberuhigter Bereich)**:
>   - Allowed to ride. Speed: `10 km/h` (Schrittgeschwindigkeit). Penalty: `5s`.
> - **Sign 244.1 (Bicycle Street / Fahrradstraße)**:
>   - Bicycles have priority. Speed: `22 km/h`. Penalty: `-10s` (bonus to prefer bicycle streets).

Please review the proposed sign rules and speed values. Let us know if we should adjust these defaults or include other traffic rules.

---

## Proposed Changes

### Logic & Routing (`src/core/`)

#### [NEW] [rules.ts](file:///home/cgodoy/work/ciclista/src/core/router/rules.ts)
Create a rules representation system.
- Define a `GermanSign` enum representing the traffic signs.
- Define `SignConfiguration` type:
  ```typescript
  export interface SignConfiguration {
    signId: string;
    name: string;
    description: string;
    iconCode: string; // e.g. "Vz242.1"
    dismountRequired: boolean;
    baseSpeedKmh: number;
    flatPenaltySeconds: number;
  }
  ```
- Implement `mapOSMToSign(highway: string, tags: Record<string, string>): { sign: GermanSign; hasFahrraederFrei: boolean }` function.
  - Check `highway === 'pedestrian'` -> `Sign 242.1`. If `bicycle === 'yes' | 'designated'`, set `hasFahrraederFrei = true`.
  - Check `highway === 'footway'` and `footway === 'sidewalk'` -> `Sign 239`.
  - Check `highway === 'path'` or `highway === 'cycleway'`:
    - If `segregated === 'yes'` -> `Sign 241`.
    - If `segregated === 'no'` -> `Sign 240`.
  - Check `highway === 'living_street'` -> `Sign 325.1`.
  - Check `bicycle_road === 'yes'` or `highway === 'bicycle_road'` -> `Sign 244.1`.
- Implement a parser that calculates speed and penalty dynamically using user configurations.

#### [MODIFY] [cost.ts](file:///home/cgodoy/work/ciclista/src/core/router/cost.ts)
Refactor the speed and penalty calculation to use the rules engine:
- Read active rule configurations from user overrides (saved in state/storage).
- Replace hardcoded sidewalk and service road penalties with rule-based evaluations.
- Add explanation metadata to `edges` details so the UI can display which traffic sign applied to each segment.

#### [MODIFY] [types.ts](file:///home/cgodoy/work/ciclista/src/core/types.ts)
Extend configuration types and structures:
- Add rules configuration object to `LocalOverrides`.
- Add traffic sign name and rules metadata to edge debug output.

---

### UI & Configuration (`src/components/`)

#### [NEW] [RulesConfigPanel.tsx](file:///home/cgodoy/work/ciclista/src/components/RulesConfigPanel.tsx)
Create a new settings card/drawer in the sidebar:
- Lists all mapped German traffic signs with their icons.
- Provides numeric sliders to tweak the `baseSpeedKmh` and `flatPenaltySeconds`.
- Toggle switch for `dismountRequired`.
- Changes instantly trigger path recalculation.

#### [MODIFY] [Sidebar.tsx](file:///home/cgodoy/work/ciclista/src/components/Sidebar.tsx)
- Integrate the `RulesConfigPanel` under a new collapsible "German Road Rules & Signs" section.
- Display sign configurations in the "Debug Route Edges" item details so the user sees exactly why a segment was slow.

---

## Verification Plan

### Automated Tests
We will add unit tests under `src/core/router/rules.test.ts` to verify:
- Tag combinations map to the correct traffic sign.
- Speed and penalty calculations correctly respect supplementary signs (like "Fahrräder frei").

### Manual Verification
- Compile the app using `pnpm run build`.
- Load Munich city center preset.
- Place start and end pins such that a pedestrian zone lies between them.
- Toggle "Fahrräder frei" values or change speed configurations in the UI settings and verify the route shifts onto cycleways or around pedestrian zones dynamically.
