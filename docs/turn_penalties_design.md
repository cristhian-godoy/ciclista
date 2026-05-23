# Implementation Plan: Semantic Turn Configurability

Thank you for that detailed breakdown. You are absolutely right—I missed the nuance of German cycling infrastructure. The difference between an *indirektes Linksabbiegen* (waiting at two pedestrian/bike lights) versus a direct left turn (mingling with cars but skipping a light phase), or a right turn with a *Grünpfeil* versus a hard stop, makes a massive difference in route calculation.

Because OpenStreetMap data rarely has this micro-level detail accurately mapped for every intersection, **we cannot rely on automatic heuristics alone**. We need to give you semantic, manual control over specific maneuvers at specific intersections, similar to what you already have for global node weights.

Here is the proposed approach to model the reality of your commute.

## 1. Architectural Changes: Edge-to-Edge Penalties

Currently, the custom configuration applies to the `Node` itself (e.g., Node 12345 = 30s wait). No matter which way you travel through it, you get the penalty.

We will update the routing engine and storage to support **Turn Penalties** (or edge-to-edge penalties). This requires tracking the sequence of nodes: `From Node A -> Via Node B (Intersection) -> To Node C`.

When calculating the cost of moving from edge 1 to edge 2, the router will check:
1. Is there a custom turn penalty for this specific maneuver?
2. If yes, use it.
3. If no, fall back to the default node wait time and basic angle heuristic.

## 2. UI Updates: The Intersection Configuration Panel

When you click an intersection on the map, the `RulesConfigPanel` will still show the general "Intersection Wait Time". 

However, we will add an "Advanced Turn Configurations" section. This section will look at the map data, find all the roads connecting to this intersection, and allow you to configure specific maneuvers.

**Example UI Concept:**
You click the intersection of *Leopoldstraße* and *Franz-Joseph-Straße*.

**General:**
* Intersection Wait Time: `[ 30s ]`

**Custom Turns (Overrides):**
*   **From:** Leopoldstraße (Northbound) **To:** Franz-Joseph-Straße (Eastbound - Right Turn)
    *   `[ Dropdown: Bypass / Free Right Turn (Baulich getrennt / Grünpfeil) (0s) ]`
*   **From:** Leopoldstraße (Northbound) **To:** Franz-Joseph-Straße (Westbound - Left Turn)
    *   `[ Dropdown: Indirect Left Turn (2 Lights) (+60s) ]`
*   **From:** Franz-Joseph-Straße (Westbound) **To:** Leopoldstraße (Southbound - Left Turn)
    *   `[ Dropdown: Nightmare Left Turn (3 Lights) (+90s) ]`

## 3. Semantic Turn Types (The Dropdown Options)

Instead of just typing in raw seconds, we will provide semantic options based on your breakdown that automatically apply the correct mathematical penalties:

**Right Turns:**
*   **Default:** (Uses the standard intersection wait time)
*   **Free Right Turn:** (Protected / *Baulich getrennt* / *Grünpfeil*) -> **0s wait time**.

**Left Turns:**
*   **Default:** (Uses standard intersection wait time + basic turn penalty)
*   **Direct Left Turn:** (Car lane merge) -> **Uses intersection wait time + 5s (oncoming traffic wait)**. Prioritized over indirect if you want to ride fast.
*   **Indirect Left Turn (Standard):** (Wait at 2 lights) -> **Intersection wait time × 2**.
*   **Nightmare Left Turn:** (Cross straight, cross left, wait again) -> **Intersection wait time × 2.5**.

## Open Questions

1. Does modeling the configuration UI as "From [Street A] to [Street B]" with semantic dropdowns solve the problem effectively for you?
2. Are there any other specific turn scenarios (like shared pedestrian zones at corners) that we should include in the semantic dropdown list?
