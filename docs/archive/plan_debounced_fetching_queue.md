# Plan: Debounced Fetching & Dynamic Network Queue

## 🎯 Objective

Refine the chunked data fetching mechanism by decoupling fast cache reads from slow network fetches, implementing a 0.5-second debounce for Overpass API queries, and introducing a dynamic queue to robustly handle user movement without dropping requests.

## 🗺️ Milestones

### Milestone 1: Decouple Cache Reading from Network Fetching (SRP & Separation of Concerns)

_Focus: Refactoring `OSMLoader` to allow immediate cache retrieval without waiting for network locks or debounce timers._

- [ ] **Task 1: Extract Cache Resolution Logic**
  - _Details_: Move the cache checking and loading logic out of the monolithic `OSMLoader.loadViewport` method into a dedicated, synchronous-like cache resolver (e.g., `OSMCacheReader`). This aligns with the Single Responsibility Principle.
- [ ] **Task 2: Enable Immediate Cache Merging**
  - _Details_: Modify the data loading pipeline so that when the viewport moves, cached chunks are immediately resolved and merged into the graph. This provides instant UI feedback for previously visited areas while the network request is debounced.

### Milestone 2: Dynamic Network Queue & Debouncing

_Focus: Handling Overpass's 1-concurrent-request limit dynamically while preventing dropped loads during user navigation._

- [ ] **Task 1: Implement a Pending Chunk Queue**
  - _Details_: Create an `OSMNetworkQueue` service. Instead of ignoring new network requests while a fetch is active, incoming needed chunks (that missed the cache) should be pushed into a `Set` of pending chunks. When the current lock releases, the queue should consume the pending chunks, calculate a merged bounding box, and fire the next Overpass query.
- [ ] **Task 2: Refactor `useOSMData` Hook Debouncing**
  - _Details_: Update `src/hooks/useOSMData.ts`. Remove the `if (isFetchingOSM) return;` guard that currently drops viewport changes. Adjust the `setTimeout` to 500ms (0.5 seconds). The hook should independently trigger the immediate cache load, and then push the remaining missing chunks to the network queue after the debounce.
- [ ] **Task 3: Ensure Clean UI State Sync**
  - _Details_: Update loading state flags (`isFetchingOSM`) to accurately reflect whether the `OSMNetworkQueue` is currently processing the pending queue, rather than locking the hook entirely.

## 📝 Notes & Open Questions

- **Overpass Query Limits**: Merging too many queued chunks could result in a bounding box that exceeds Overpass timeout or data limits. The network queue should respect `MAP_CONFIG.MAX_LAT_SPAN` and split requests if the queued bounding box grows too large.
- **Cache Invalidation/Updates**: If we read from the cache immediately, should we occasionally re-fetch network data in the background to keep the cache fresh? For now, we stick to YAGNI and only fetch chunks that are completely missing.
- **Cancellation**: If a user pans far away quickly, should we abort the queued chunks from the intermediate areas? Implementing an `AbortController` for the queue might be beneficial, but could overcomplicate the initial queue design (KISS). We can start with a simple FIFO or "latest merged bbox" approach.
