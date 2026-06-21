# Plan: Frontend Attribution UI

## 🎯 Objective

Add a dedicated section to the frontend sidebar to properly credit open-source libraries, assets, and data sources used in the project, fulfilling open-source licensing and attribution requirements in an unobtrusive way.

## 🗺️ Milestones

### Milestone 1: Attribution Component Creation

_Focus: Designing the component and compiling the list of open-source projects to attribute._

- [ ] **Task 1: Compile Open Source Attributions List**
  - _Details_: Create a static data structure containing the dependencies and assets used. This should include:
    - **Map Data**: OpenStreetMap contributors (ODbL).
    - **Core UI**: React, React DOM (MIT).
    - **Map Rendering**: MapLibre GL JS (BSD 3-Clause).
    - **Icons**: Lucide React (ISC).
    - **Build/Tooling**: Vite, TypeScript, ESLint (MIT).
- [ ] **Task 2: Implement `AttributionPanel` Component**
  - _Details_: Create a new component `src/components/AttributionPanel.tsx`. The component should use an expandable "accordion" style (similar to the sections in `RulesConfigPanel.tsx`), utilizing a state variable and `ChevronDown`/`ChevronUp` icons to reveal the content only when clicked. Inside the expanded view, display the attributions grouped or listed cleanly with small, muted text.

### Milestone 2: Integration & Polish

_Focus: Placing the component in the application layout and ensuring it looks premium._

- [ ] **Task 1: Integrate into `Sidebar.tsx`**
  - _Details_: Import `AttributionPanel` into `src/components/Sidebar.tsx`. Place it at the very bottom of the `<div className="sidebar-content">` container. This ensures it is naturally discovered by scrolling down the sidebar, avoiding cluttering the primary viewport or the sticky footer.
- [ ] **Task 2: CSS and Typography Polish**
  - _Details_: Ensure the styling adheres to the `ciclista-card` conventions. Use `var(--ciclista-color-text-muted)` for the descriptions and license names to keep the visual weight low but legible.

## 📝 Notes & Open Questions

- **MapLibre's Default Attribution**: MapLibre GL displays its own attribution control on the map canvas by default. Do we want to keep that control, hide it, or sync it with this new panel?
- **Link Behavior**: Should the attribution items include clickable external links to their respective repositories/licenses, or just text?
