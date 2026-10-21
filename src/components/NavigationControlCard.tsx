import { Compass, Navigation2, Play, Square } from 'lucide-react';
import React from 'react';

import type { CameraMode, NavigationProgress } from '../core/navigation/types';

/**
 * Properties for the NavigationControlCard component.
 */
export interface NavigationControlCardProps {
  /** Whether turn-by-turn navigation is currently running or paused */
  isNavigating: boolean;
  /** Callback fired to begin simulated or GPS turn-by-turn navigation */
  onStartNavigation: () => void;
  /** Callback fired to terminate active navigation */
  onStopNavigation: () => void;
  /** Callback fired to switch camera between north-up and heading-up follow modes */
  onToggleCameraMode: () => void;
  /** Active camera orienting mode */
  cameraMode: CameraMode;
  /** Real-time progress metric snapshot */
  navigationProgress: NavigationProgress | null;
  /** Optional callback fired prior to starting navigation, e.g. To collapse sidebar */
  onBeforeStartNavigation?: () => void;
}

/**
 * Sidebar card component presenting navigation initiation or active journey telemetry.
 */
export const NavigationControlCard: React.FC<NavigationControlCardProps> = ({
  isNavigating,
  onStartNavigation,
  onStopNavigation,
  onToggleCameraMode,
  cameraMode,
  navigationProgress,
  onBeforeStartNavigation,
}) => {
  return (
    <div className="ciclista-card sidebar-nav-card">
      {!isNavigating ? (
        <button
          className="ciclista-btn ciclista-btn--primary sidebar-nav-btn"
          onClick={() => {
            onBeforeStartNavigation?.();
            onStartNavigation();
          }}
        >
          <Play size={16} />
          Start Navigation
        </button>
      ) : (
        <div className="sidebar-active-nav">
          <div className="sidebar-active-row">
            <span className="sidebar-active-title">Active Navigation</span>
            <div className="sidebar-actions-group">
              <button
                className="ciclista-btn ciclista-btn--secondary sidebar-icon-btn"
                onClick={onToggleCameraMode}
                title={`Toggle camera mode (current: ${cameraMode})`}
              >
                {cameraMode === 'north-up' ? <Compass size={16} /> : <Navigation2 size={16} />}
              </button>
              <button
                className="ciclista-btn ciclista-btn--danger sidebar-icon-btn"
                onClick={onStopNavigation}
                title="Stop Navigation"
              >
                <Square size={16} />
              </button>
            </div>
          </div>
          {navigationProgress && (
            <div className="sidebar-nav-grid">
              <div>
                <div className="sidebar-nav-lbl">Remaining</div>
                <div className="sidebar-nav-val">
                  {navigationProgress.distanceRemainingM >= 1000
                    ? `${(navigationProgress.distanceRemainingM / 1000).toFixed(1)} km`
                    : `${Math.round(navigationProgress.distanceRemainingM)} m`}
                </div>
              </div>
              <div>
                <div className="sidebar-nav-lbl">ETA</div>
                <div className="sidebar-nav-val">
                  {Math.floor(navigationProgress.etaSeconds / 60) > 0
                    ? `${Math.floor(navigationProgress.etaSeconds / 60)}m ${Math.round(navigationProgress.etaSeconds % 60)}s`
                    : `${Math.round(navigationProgress.etaSeconds)}s`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
