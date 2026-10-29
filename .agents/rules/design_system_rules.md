# Rule: Design System Governance and Component Reuse

## Activation
- **Always On**

## Guidelines

1. **Token Usage**:
   - Prioritize existing design tokens from `src/styles/variables.css` (`var(--ciclista-*)`). Define new tokens only when existing colors, spacing increments, or radii do not suffice.
   - Do NOT use raw color literals (`#hex`, `rgb`, `hsl`) in JSX attributes or inline styles.

2. **Component & Style Reuse**:
   - Reuse existing UI layout components (`<Sidebar />`, `<GlobalControlsPanel />`, `<MapView />`) and design system CSS classes (`.ciclista-btn`, `.ciclista-btn--primary`, `.ciclista-btn--secondary`, `.ciclista-input`, `.ciclista-select`, `.ciclista-slider`, `.ciclista-card`, `.ciclista-glass-panel`).
   - Adhere to the defined CSS class namespace prefixes (`ciclista-*`, `map-*`, `hud-*`, `rules-*`, `stats-*`, etc.).

3. **Theme Integration**:
   - Propagate and consume dynamic theme state (`theme` context or props) across all page routes and components. Avoid hardcoding light- or dark-mode values.
