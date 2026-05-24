# OpenFreeMap Vector Migration Plan

This document outlines the bite-sized steps required to migrate off the commercial CARTO raster map tiles and onto entirely free, vector-based map tiles provided by OpenFreeMap. It also includes fixing the Content-Security-Policy (CSP) which is currently blocking map rendering, and adding a dynamic theme selector.

## Bite-size rule

**Each bite touches a minimal set of files, produces a clean build, and is independently committable.** No bite should require understanding another in-progress bite to be reviewed.

## Phase 1: Fixing the Content-Security-Policy (CSP)

- [x] **Bite 1.1: Restore and Update CSP**
  - **File:** `index.html`
  - **Action:** Uncomment the CSP meta tag.
  - **Action:** Update the `connect-src` directive to include `https://tiles.openfreemap.org`.
  - **Action:** Add `worker-src blob: 'self';` and `child-src blob: 'self';`. (MapLibreGL requires Web Workers and Blobs to decode and render vector tiles client-side).

## Phase 2: Swapping to OpenFreeMap Vectors

- [x] **Bite 2.1: Replace MapLibre Style Object**
  - **File:** `src/components/map/useMapInstance.ts`
  - **Action:** Remove the massive inline JSON style object that defines the `carto-dark` raster source and layer.
  - **Action:** Replace it with the OpenFreeMap vector style URL. Default to `'https://tiles.openfreemap.org/styles/bright'`.

## Phase 3: Map Theme Selector

- [x] **Bite 3.1: Add Map Theme State**
  - **File:** `src/App.tsx` and `src/components/Sidebar.tsx`
  - **Action:** Add a React state for the selected map theme (`bright`, `liberty`, or `dark`), defaulting to `bright`.
  - **Action:** Add a dropdown or toggle control in the Sidebar to switch this state.
- [x] **Bite 3.2: Reactive Style Updates**
  - **File:** `src/components/map/useMapInstance.ts`
  - **Action:** Pass the selected theme as a new parameter into `useMapInstance`.
  - **Action:** Add a `useEffect` to call `map.setStyle('https://tiles.openfreemap.org/styles/' + theme)` whenever the theme changes dynamically.
  - _Note: Our dark glassmorphism UI might contrast weirdly with the `bright` map theme, but we are acknowledging this for now and will fix the overarching CSS theming in a later pass._

## Phase 4: Verification

- [x] **Bite 4.1: Manual Verification**
  - Start the dev server (`pnpm dev`).
  - Open the browser developer console.
  - Verify that the map loads crisp vector tiles instead of blurry rasters.
  - Verify there are absolutely zero red CSP violation errors in the console.
  - Verify you can swap seamlessly between `bright`, `liberty`, and `dark`.
