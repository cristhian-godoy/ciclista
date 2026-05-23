# Milestone 0: Core Engine, Semantic Mapping & Control Point Configurability

## Phase A: Node-Level Selection & Visualizing Controls on Map
- [x] **Bite 0.A.1: Update Graph Adjacency List to Keep Node Tags**
  - [x] Ensure all parsed OSM nodes with tags like `highway=give_way`, `highway=stop`, `highway=crossing`, etc. are fully preserved in the graph.
- [x] **Bite 0.A.2: Render Controls (Yield, Stop, Crossing) on the Map**
  - [x] Add MapLibre sources and layers to render these control points alongside traffic lights.
  - [x] Distinguish their control types using color-coding.
- [x] **Bite 0.A.3: Make Non-Signal Controls Selectable**
  - [x] Wire map click listeners to select these control nodes and center/highlight them.
- [x] **Bite 0.A.4: Highlight Active Custom Node Overrides**
  - [x] Render a visual overlay (halo or indicator) for nodes that have an active custom override in `customNodeDelays`.

## Phase B: Core Routing Engine Integration for Controls
- [x] **Bite 0.B.1: Default Delays for Yield/Stop/Crossing**
  - [x] Integrate default base delays for yield signs (e.g. 5s) and stop signs (e.g. 8s) in `src/core/router/cost.ts`.
- [x] **Bite 0.B.2: Support Custom Overrides for All Controls**
  - [x] Ensure custom node overrides apply correctly to yield and stop nodes during routing.

## Phase C: Granular Node Configurator Popup
- [x] **Bite 0.C.1: Clean Metadata Display in Node Drawer**
  - [x] Show the control type ("Yield Sign", "Stop Sign", "Traffic Signal") and OSM tags cleanly.
- [x] **Bite 0.C.2: Node Preset Buttons**
  - [x] Offer pre-configured delay presets depending on the control type.
