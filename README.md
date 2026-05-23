# Ciclista - Personal Cycling Route Planner

Ciclista is a routing tool I built to optimize my daily 10 km commute in Munich. Standard routers usually prioritize the shortest path or highest average speed limit. However, they don't account for localized commuter friction—like intersections where buses constantly trigger red lights, or roads that are technically cycleable but unpleasant due to heavy traffic.

This project downloads street networks from OpenStreetMap (OSM) and lets you apply custom wait times to specific traffic signals, crossings, or road types. The goal is to find alternative routes that optimize for rolling momentum and quieter paths, rather than just raw distance.

---

## Features

* **Map Area Loader:** Download street networks for a chosen bounding box directly from the Overpass API.
* **Client-Side Graph Router:** Dijkstra routing implemented in TypeScript using a custom binary Min-Heap. Routes are computed locally in the browser.
* **Wait Time Adjustments:** Click on any mapped traffic signal, stop sign, yield sign, or crossing to override its default wait delay.
* **Custom Route Strategies:** Compare three different pathfinding strategies:
  * ⚡ **Speed:** The fastest path according to legal limits.
  * 🛑 **Avoid Stops:** Adds wait penalties to stop signs, signals, and pedestrian crossings to prioritize rolling momentum.
  * 🌳 **Quiet Paths:** Prioritizes cycle tracks and residential streets over high-traffic arterials.
* **Comparison Dashboard:** Compare estimated travel times, distance, and road type breakdowns side-by-side.

---

## Tech Stack & Architecture

To prevent vendor lock-in, the application is strictly layered:
* **Domain & Logic (`src/core/`):** Contains pure, testable TypeScript modules for routing (`router.ts`), dynamic weighting (`cost.ts`), data parsing (`parser.ts`), and local storage (`storage.ts`). It has zero dependencies on React or MapLibre.
* **UI & Components (`src/components/`):** React components managing state, sliders, and coordinate entries.
* **Styles (`src/styles/`):** Vanilla CSS files utilizing structured HSL styling tokens.

---

## Routing Optimization & Heuristics

To ensure the router suggests realistic and safe commuting routes rather than mathematically short but impractical paths, the costing engine implements several heuristics:

1. **Sidewalk & Footway Penalties**: Generic sidewalks and pedestrian paths are heavily penalized to prevent the router from suggesting them when parallel to regular streets, unless they explicitly allow bicycles.
2. **Intersection Turn Penalties**: Sharp turns and U-turns are penalized to prevent tricky detours designed merely to bypass traffic lights.
3. **Service Road & Parking Aisle Restrictions**: Driveways and parking aisles have reduced speeds and added time penalties to discourage the router from using them as shortcuts.
4. **Edge Snapping**: Start and end coordinates snap cleanly to the nearest street segment rather than distant intersections, giving a more accurate reflection of the real commute.

---

## Data Customization & Storage
All customized traffic light timings and notes are stored directly in your browser's `localStorage`, ensuring your personal route weights are preserved across reloads without needing an external database.

---

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* `pnpm` (run via `npx` if not installed globally)

### Installation
Clone the repository and install dependencies:
```bash
pnpm install
```

### Running Locally
Launch the development server:
```bash
pnpm run dev
```
Open `http://localhost:5173/` in your browser.

### Quality Verification
To run the linter and unit test suites:
```bash
pnpm lint
pnpm test
```

### Building for Production
Bundle the optimized compilation output:
```bash
pnpm run build
```
The compiled assets will be built in the `dist/` directory.

---
*Built with leftover Gemini tokens.*
