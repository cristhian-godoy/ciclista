# Ciclista: Long-Term Project Roadmap

This document outlines the strategic vision and technical milestones for Ciclista. It serves as a high-level guide to transition the project from a static desktop routing engine into a dynamic, personalized, and active commuting companion.

---

## 🏁 Milestone 0: Core Engine & Semantic Mapping
**Status:** **ALMOST DONE**

Establish a fully client-side routing architecture capable of semantic evaluation of OpenStreetMap data based on actual traffic signs and road types.

* **[x] Client-Side Router:** Pure TypeScript Dijkstra implementation using a Min-Heap queue.
* **[x] Map Rendering:** Integration with MapLibre GL JS and custom WebGL vectors.
* **[x] Rules Engine:** Parse OSM data into conceptual `GermanSign` and `RoadType` classifications.
* **[x] Dynamic Penalties:** Real-time cost adjustments for turns, traffic lights, and unpaved roads.
* **[x] Local Storage:** Persist UI configurations and custom node adjustments across sessions.
* **[ ] Further Improvements:** We can improve the core engine even more, incl UI configurability

---

## 🚴 Milestone 1: Time Calibration & Analytics (The "Trust" Phase)
**Status:** 🚧 **IN PROGRESS**

The current routing costs are optimized for *preference* (penalizing bad paths), resulting in inflated, unrealistic ETAs. This milestone separates logical routing weights from real-world display time, while providing visual comparisons between route strategies.

* **[ ] Phase A: Time Calibration & Bike Profiles**
    * Introduce bike profiles (e.g., Slow, Normal, E-Bike) with distinct top speeds.
    * Separate `routingCost` (used by Dijkstra for pathfinding) from `displayCost` (true chronological time based on distance/speed limits and real node delays).
    * Clamp road speeds dynamically: `effectiveSpeed = Math.min(roadDefaultConfigSpeed, activeBikeProfile.topSpeed)`.
* **[ ] Phase B & C: Telemetry Analytics**
    * Accumulate metadata along edges during path reconstruction.
    * Count distinct events: Yields (`highway=give_way`), Signals, Crossings.
    * Calculate road-type composition (% cycleway, % residential, % primary).
* **[ ] Phase D & E: Alternative Routing Comparison**
    * Modify the engine to run multiple strategies (Standard, Avoid Stops, Quiet) sequentially.
    * Render all alternative paths on the MapLibre canvas with distinct opacities.
    * Build a side-by-side analytics comparison panel in the sidebar.

---

## 📱 Milestone 2: The Pocket Companion
**Status:** ⏳ **PENDING**

Transition the application from a desktop planning tool into a mobile-friendly reference tool that can be mounted on the handlebars.

* **[ ] Progressive Web App (PWA) Conversion**
    * Integrate `vite-plugin-pwa` for manifest generation and service worker caching.
    * Enable "Install to Home Screen" capability and configure offline asset caching (HTML/CSS/JS/Icons).
* **[ ] Live Geolocation Tracking**
    * Implement `navigator.geolocation.watchPosition()` to stream high-accuracy device coordinates.
    * Plot a directional "User Location" marker on the MapLibre canvas.
    * Add a "Snap to Me" UI toggle to center the viewport on the user's location.
* **[ ] Screen Wake Lock**
    * Implement the `WakeLock` API to prevent the phone screen from dimming/sleeping while the map is active.

---

## 📡 Milestone 3: Telemetry & The Feedback Loop
**Status:** ⏳ **PENDING**

Transform Ciclista from a static map into an engine that learns from your actual commutes, solving the "unknown wait time" problem at specific intersections.

* **[ ] Background Ride Recording**
    * Capture raw GPS coordinate arrays locally during active rides.
    * Store telemetry data locally using `IndexedDB` (to handle larger payloads than `localStorage`).
* **[ ] Heuristic Dwell-Time Extraction**
    * Build an algorithm to parse recorded tracks and identify "zero-speed clusters" (where the bike is stationary).
    * Cross-reference these clusters geographically against known OSM `highway=traffic_signals` or `highway=give_way` nodes.
    * Calculate the average dwell time per intersection.
* **[ ] Automatic Cost Syncing**
    * Feed the aggregated wait times back into the `customNodeCosts` configurations to automatically personalize future routing ETAs and pathfinding weights.

---

## 🧭 Milestone 4: Active Turn-by-Turn Navigation
**Status:** ⏳ **PENDING**

The ultimate goal: moving from a reference line on a map to an active co-pilot.

* **[ ] GPS Map Matching (Edge Snapping)**
    * Raw GPS is noisy. Implement logic to snap the current coordinate to the nearest valid graph edge to determine exactly which segment of the route the user is on.
* **[ ] Off-Route Detection & Recalculation**
    * Detect when the user deviates from the active path threshold.
    * Automatically trigger the fast (< 15ms) Dijkstra engine to recalculate from the newly snapped edge.
* **[ ] Look-Ahead Instructions**
    * Analyze the upcoming edges in the `RouteResult` array to generate text instructions (e.g., "Turn left onto cycleway in 50 meters").
    * Implement high-contrast visual cues (arrows) and potential Web Speech API integration for audio cues.
