import { FlaskConical, Navigation, Route, ShieldAlert, Star } from 'lucide-react';
import React from 'react';

/**
 * Supported view and workflow modes within the Ciclista toolbar.
 */
export type ToolbarMode = 'routing' | 'landmarks' | 'studio';

/**
 * Properties for the SideToolbar component.
 */
export interface SideToolbarProps {
  /**
   * The currently active mode ('routing', 'landmarks', or 'studio').
   */
  mode: ToolbarMode;
  /**
   * Callback fired when changing between toolbar modes.
   */
  onModeChange: (mode: ToolbarMode) => void;
  /**
   * Optional callback triggered when the test runner button is clicked.
   */
  onOpenTestRunner?: () => void;
}

/**
 * Non-floating left side toolbar docked against the left edge of the viewport.
 * Provides rapid switching between routing mode, studio mode, and the test suite.
 */
export const SideToolbar: React.FC<SideToolbarProps> = ({
  mode,
  onModeChange,
  onOpenTestRunner,
}) => {
  const handleTestRunnerClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onOpenTestRunner) {
      e.preventDefault();
      onOpenTestRunner();
    }
  };

  return (
    <aside className="ciclista-toolbar" aria-label="Main application toolbar">
      <div className="ciclista-toolbar-header">
        <div className="ciclista-toolbar-logo" title="Ciclista" aria-label="Ciclista">
          <Navigation size={22} className="ciclista-toolbar-logo-icon" />
        </div>
      </div>

      <nav className="ciclista-toolbar-nav" aria-label="Primary navigation modes">
        <button
          type="button"
          className={`ciclista-toolbar-btn ${mode === 'routing' ? 'active ciclista-toolbar-btn--active' : ''}`}
          onClick={() => onModeChange('routing')}
          aria-label="Routing Mode"
          title="Routing Mode"
          aria-pressed={mode === 'routing'}
        >
          <Route size={20} className="ciclista-toolbar-icon" />
        </button>

        <button
          type="button"
          className={`ciclista-toolbar-btn ${mode === 'landmarks' ? 'active ciclista-toolbar-btn--active' : ''}`}
          onClick={() => onModeChange('landmarks')}
          aria-label="Landmarks Mode"
          title="Landmarks (Favorites & POI)"
          aria-pressed={mode === 'landmarks'}
        >
          <Star size={20} className="ciclista-toolbar-icon" />
        </button>

        <button
          type="button"
          className={`ciclista-toolbar-btn ${mode === 'studio' ? 'active ciclista-toolbar-btn--active' : ''}`}
          onClick={() => onModeChange('studio')}
          aria-label="Studio Mode"
          title="Studio Mode"
          aria-pressed={mode === 'studio'}
        >
          <ShieldAlert size={20} className="ciclista-toolbar-icon" />
        </button>
      </nav>

      <div className="ciclista-toolbar-footer">
        <a
          href="/test"
          className="ciclista-toolbar-btn ciclista-toolbar-btn--test"
          aria-label="Test Runner"
          title="Test Runner"
          onClick={handleTestRunnerClick}
        >
          <FlaskConical size={20} className="ciclista-toolbar-icon" />
        </a>
      </div>
    </aside>
  );
};
