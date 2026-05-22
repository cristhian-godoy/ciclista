# Ciclista - Custom Cycling Route Planner

Ciclista is a lightweight, interactive web application built with **React, TypeScript, Vite, and MapLibre GL JS** to plan and optimize cycling routes. 

Unlike standard routers that prioritize raw distance or speed limit averages, Ciclista is designed for the urban commuter. It lets you customize node-level properties (like average wait times at traffic signals) and apply turn-penalty adjustments (like avoiding busy left turns) to compute the most comfortable, continuous, and convenient cycling path.

---

## Features

* **Interactive Map Visualization:** Powered by **MapLibre GL JS** with custom WebGL vectors showing the parsed cycling street network.
* **Client-Side Graph Router:** High-performance Dijkstra routing implemented in pure TypeScript using a custom binary Min-Heap. Routes on graphs up to 10,000 nodes are computed in **under 15 milliseconds** inside the browser.
* **Stop Light Time Adjustments:** Click on any mapped traffic signal to adjust its average wait delay. The optimal path updates in real-time.
* **Custom Route Strategies:** Toggle between:
  * **Speed:** Default fastest routing.
  * **Avoid Stops:** Multiplies stop penalties (traffic lights, crossings) to promote a rolling-momentum ride.
  * **Quiet Paths:** Penalizes secondary/primary roads lacking dedicated cycle tracks to guide you toward residential streets and alleys.
* **Direct OpenStreetMap (OSM) Integration:** Enter bounding box coordinates to download and build maps of your neighborhood directly from the public **Overpass API**.

---

## Tech Stack & Architecture

To prevent vendor lock-in, the application is strictly layered:
* **Domain & Logic (`src/core/`):** Contains pure, testable TypeScript modules for routing (`router.ts`), dynamic weighting (`cost.ts`), data parsing (`parser.ts`), and local storage (`storage.ts`). It has zero dependencies on React or MapLibre.
* **UI & Components (`src/components/`):** React widgets managing state, sliders, and coordinate entries.
* **Styles (`src/styles/`):** Vanilla CSS files utilizing structured HSL styling tokens, full-viewport absolute grids, and glassmorphic drawer containers.

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
Launch the hot-reloading development server:
```bash
pnpm run dev
```
Open `http://localhost:5173/` in your browser.

### Building for Production
Bundle the optimized compilation output:
```bash
pnpm run build
```
The compiled assets will be built in the `dist/` directory.

---

## Data Customization & Storage
All traffic light timings and notes are stored directly in your browser's `localStorage` under the key `ciclista_custom_nodes`, ensuring your custom route weights are preserved across reloads.
