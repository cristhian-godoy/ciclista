# Custom Cycling Route Planner: Feasibility Study & TS/JS Stack

This document outlines the architecture, feasibility, and implementation plan for a **100% TypeScript & React** web application. It completely avoids Python, leveraging browser-based computation for real-time routing, interactive maps, and localized node customization.

---

## 1. Feasibility Analysis (TypeScript Stack)

* **Overall Feasibility:** **Very High**
* **Complexity Level:** **Moderate**
* **Performance:** **Excellent**. A typical urban commuting graph (e.g., 5km x 5km) contains ~8,000 nodes and ~15,000 edges. Running Dijkstra's algorithm in JavaScript on a network of this size takes **under 15 milliseconds**, allowing for instant route recalculations as you drag pins or edit delays.

### Why a Client-Side TS/JS Approach is Superior for Your Needs:
1. **Zero Server Setup:** You don't need to run a complex local database or routing server. The app can run completely in the browser as a React Single Page Application (SPA).
2. **Instant Feedback:** When you click a traffic light and change its delay from "30 seconds" to "60 seconds", the route recalculates in the browser instantly without waiting for network roundtrips.
3. **No Database Configuration:** Local settings (like custom traffic light wait times or turn penalties) can be stored directly in the browser using `localStorage` or `IndexedDB`. If you want to keep these settings tracked in git, we can add a very simple Node/TypeScript server to save them to a local JSON file.

---

## 2. The Modern JS/TS Stack

Here is the exact stack we will use for this project:

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Build & Tooling** | **Vite + TypeScript** | Ultra-fast development server and modern type safety. |
| **UI Framework** | **React** | Component-driven UI for controls, settings, and node panels. |
| **Map Rendering** | **MapLibre GL JS** | High-performance WebGL vector map rendering. Smooth zoom and rotation. |
| **Data Fetching** | **Overpass API (OSM)** | Downloads raw OSM JSON data for your city's bounds directly from the frontend. |
| **Graph & Routing** | **Custom TS Dijkstra** | A lightweight, customized graph router built directly in TypeScript. |
| **Persistence** | **Local DB / Node.js** | Saves your customized delays/node settings (either in browser storage or local disk). |

---

## 3. Architecture & Data Flow

```mermaid
graph TD
    subgraph Browser (React App)
        Map[MapLibre GL JS Map]
        UI[Sidebar Controls & Panels]
        Parser[OSM-to-Graph Parser]
        Router[Custom TypeScript Dijkstra]
        Storage[Browser LocalStorage / IndexedDB]
    end

    subgraph Data Sources
        Overpass[Overpass API Server]
    end

    Overpass -->|Fetch Raw OSM JSON| Parser
    Parser -->|Build Topological Graph| Router
    Storage -->|Inject Custom Node Weights| Router
    Map -->|User Clicks Node/Drags Pins| UI
    UI -->|Update Custom Delay| Storage
    UI -->|Trigger Re-route| Router
    Router -->|GeoJSON Path| Map
```

---

## 4. How the Custom TS Router Works

To implement traffic light delays and turn penalties, we will build a simple, clean adjacency list graph representation in TypeScript.

### A. Graph Representation
We convert OSM ways and nodes into a graph structure:
```typescript
interface GraphNode {
  id: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface GraphEdge {
  target: string;
  distance: number;       // In meters
  speedLimit: number;     // In m/s
  tags: Record<string, string>;
}

// The main topological graph representation
type StreetGraph = Map<string, {
  node: GraphNode;
  edges: GraphEdge[];
 }>;
```

### B. Dynamic Costing with Custom Penalties
When we run Dijkstra's algorithm, the weight of an edge depends on the physical distance, the speed limit, and any custom overrides you've added (like a long traffic light):

```typescript
function calculateEdgeCost(
  sourceId: string,
  edge: GraphEdge,
  customDelays: Map<string, number>
): number {
  // 1. Base travel time (seconds) = distance / speed
  const speed = edge.speedLimit || 5.0; // Default 18 km/h cycling speed
  let cost = edge.distance / speed;

  // 2. Apply road type adjustments (penalize busy streets without bike lanes)
  const isBikeLane = edge.tags['cycleway'] || edge.tags['cycleway:left'] || edge.tags['cycleway:right'];
  if (!isBikeLane && ['primary', 'secondary'].includes(edge.tags['highway'])) {
    cost *= 1.5; // Penalize busy roads by making them feel 50% slower
  }

  // 3. Add custom node delays at the destination node (traffic lights, bad crossings)
  const targetId = edge.target;
  const customDelay = customDelays.get(targetId) || 0;
  cost += customDelay;

  // 4. Default penalty for generic un-timed traffic lights in OSM
  const targetNode = graph.get(targetId)?.node;
  if (targetNode?.tags['highway'] === 'traffic_signals' && !customDelays.has(targetId)) {
    cost += 15; // Default 15-second delay for traffic lights
  }

  return cost;
}
```

---

## 5. Step-by-Step Implementation Plan

### Phase 1: Bootstrap React + MapLibre App
* [x] Create a React + TS project using Vite.
* [x] Setup MapLibre GL JS and set up a beautiful base map (CartoDB Dark Matter for a premium dark mode UI).
* [x] Implement bounding-box selection: Let the user drag a box over their city or insert coordinates to define their riding area.

### Phase 2: OSM Data Fetching & Graph Parsing
* [x] Implement an Overpass API client in TypeScript to query bikeable streets inside the bounding box.
* [x] Parse the Overpass XML/JSON response to construct the topological `StreetGraph` map in memory.
* [x] Verify the graph topology by drawing the street network onto the MapLibre map.

### Phase 3: Routing Engine & Customization UI
* [x] Implement a custom Dijkstra routing algorithm in TypeScript.
* [x] Enable drag-and-drop Start and End markers on the map to find and render the shortest path.
* [x] Render traffic lights as interactive circles on the map.
* [x] Implement a beautiful side drawer: clicking on a traffic light lets you set average wait times (stored in `localStorage`).
* [x] Recalculate and update the route path instantly when local settings change.

### Phase 4 (Optional): Node Persistence Backend
* [ ] Build a tiny Node.js/TypeScript backend (e.g., Express or Fastify) if you want to persist the node delay database directly to your hard drive in a JSON/SQLite file instead of browser storage.
