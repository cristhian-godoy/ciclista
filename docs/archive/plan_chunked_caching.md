# Plan: Chunk-Based OSM Caching

## 🎯 Objective

Refactor the Overpass API fetching and caching strategy to use a fixed grid of chunks (~1km x 1km). This will significantly improve cache hit rates during map panning and page refreshes, while ensuring we strictly make only one merged Overpass query at a time for non-cached chunks.

## 🚫 Constraints (What Cannot Change)

1. **Strict Concurrency Limit**: Querying Overpass **cannot be parallelized**. There must be strictly only one call to Overpass at any given time to avoid rate limiting and shadow bans.
2. **Preserve Query Optimization**: The Overpass QL query is perfectly optimized for our needs. The query logic, element filters, and output format **must not change**. The only allowable modification is dynamically substituting the search coordinates (e.g., replacing the single bounding box with a merged bounding box, or multiple area queries if Overpass QL supports it for our current structure).

## 🗺️ Milestones

### Milestone 1: Chunk Math and Geometry Utilities

_Focus: Implement core pure functions for mapping coordinates and viewports to fixed grid chunks._

- [ ] **Define Chunk Dimensions**: Add chunk sizing constants to `core/common/constants.ts`.
  - _Details_: Use `~0.01` degree intervals to approximate 1km x 1km chunks.
- [ ] **Create Coordinate to Chunk Mappers**: Add pure functions in `core/common/geo.ts` to translate coordinates.
  - _Details_: Create `coordToChunkId(lat, lng)`, `getChunksInBBox(bbox)`, and `getChunkBBox(chunkId)`. Include a safety limit guard in `getChunksInBBox` to abort loading (returning an empty array and logging a comment) if the user zooms out too far (e.g., country level).
- [ ] **Create Chunk Merger**: Add a function to merge multiple chunks into a single BBox.
  - _Details_: Create `mergeChunksToBBox(chunkIds)` which computes the minimal bounding box encompassing all provided chunk IDs.

### Milestone 2: Cache Key Refactoring & Local Indexing

_Focus: Update CacheStorage to be easily queryable for locally cached areas without full Overpass QL regex parsing._

- [ ] **Explicit URL Bounding Boxes**: Update `fetchWithCacheAndFallback` in `core/api/overpass.ts` to embed the bounding box explicitly in the cache URL (e.g., `?bbox=min,min,max,max`).
- [ ] **Implement Cache Indexer**: Add a `getValidCacheEntries()` utility in `core/storage/cache.ts`.
  - _Details_: This should iterate over `caches.keys()`, parse the `bbox` parameters from the URLs, check `X-Cache-Timestamp` for TTL, and return an array of currently valid cached areas.

### Milestone 3: The Loading Facade

_Focus: Extract and orchestrate chunk resolution, cache checking, and API calling into a dedicated service._

- [ ] **Create `OSMLoader` Service**: Extract API fetching logic out of `useOSMData.ts` into a new decoupled service.
  - _Details_: The loader will take the viewport BBox, map it to required chunks, and filter out chunks already in the active memory graph.
- [ ] **Cross-Reference Cache**: Use `getValidCacheEntries()` to identify which required chunks are fully covered by existing `CacheStorage` entries.
  - _Details_: Load and parse the responses for these covered chunks directly from the local cache.
- [ ] **Orchestrate Single Network Query**: Collect all remaining non-cached chunks.
  - _Details_: Merge them into a single bounding box using `mergeChunksToBBox()`. Implement a strict concurrency lock (or boolean flag) to guarantee only ONE Overpass call happens at a time. Fetch, parse, merge into the graph, and update `CacheStorage`.

### Milestone 4: Hook Refactoring

_Focus: Clean up the React hook to integrate the new facade cleanly._

- [ ] **Simplify `useOSMData.ts`**: Remove the internal 20% BBox padding and custom overlap checks.
  - _Details_: The hook should now just act as a simple bridge that debounces map movements and passes the raw viewport bounds directly to the new `OSMLoader`.

## 📝 Notes & Open Questions

- What should be the exact artificial limit of chunks to load before bailing out to prevent performance/memory issues on extreme zoom-outs?
