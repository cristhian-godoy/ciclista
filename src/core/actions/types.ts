import type { AppSettings, SettingCategory } from '../config';
import type { BikeConfig } from '../config/types';
import type { Landmark } from '../landmarks/types';
import type { CameraMode } from '../navigation/types';

/**
 * Supported workflow and view modes.
 */
export type AppMode = 'routing' | 'places' | 'events' | 'edit' | 'debug' | 'studio' | 'landmarks';

/**
 * Result returned by an action availability checker.
 */
export interface ActionAvailability {
  /** Whether the action can currently execute */
  available: boolean;
  /** Human-readable explanation if action is unavailable */
  reason?: string;
}

/**
 * Contextual routing state consumed by executable actions.
 */
export interface ActionRoutingState {
  /** Selected origin coordinate */
  startCoord: [number, number] | null;
  /** Selected destination coordinate */
  endCoord: [number, number] | null;
  /** Whether a route is actively computed and displayed */
  hasActiveRoute: boolean;
  /** Active routing strategy label */
  routingStrategy?: string;
  /** Active bike configuration */
  bikeConfig?: BikeConfig;
  /** Callback to invert origin and destination */
  swapStartEnd?: () => void;
  /** Callback to clear active route points */
  clearRoute?: () => void;
  /** Callback to update routing strategy */
  setRoutingStrategy?: (strategy: string) => void;
  /** Callback to update bike config */
  setBikeConfig?: (config: BikeConfig) => void;
}

/**
 * Contextual navigation state consumed by executable actions.
 */
export interface ActionNavigationState {
  /** Whether turn-by-turn navigation or simulation is in progress */
  isNavigating: boolean;
  /** Active camera orienting mode */
  cameraMode?: CameraMode;
  /** Callback to begin simulated navigation */
  startNavigation?: () => void;
  /** Callback to terminate active navigation */
  stopNavigation?: () => void;
  /** Callback to toggle between north-up and heading-up follow camera */
  toggleCameraMode?: () => void;
}

/**
 * Contextual map state consumed by executable actions.
 */
export interface ActionMapState {
  /** Whether street graph vector layer is visible */
  showStreetGraph: boolean;
  /** Callback to toggle street graph vector layer */
  toggleStreetGraph?: () => void;
  /** Callback to zoom viewport to encompass active route */
  fitRouteBounds?: () => void;
  /** Whether node inspection mode is active */
  isInspectorActive?: boolean;
  /** Callback to toggle node inspection overlay */
  toggleInspector?: () => void;
}

/**
 * Contextual places state consumed by executable actions.
 */
export interface ActionPlacesState {
  /** List of registered places/landmarks */
  places: Landmark[];
  /** Callback to select and inspect a place */
  selectPlace?: (place: Landmark) => void;
  /** Callback to set coordinate as route origin */
  setAsStart?: (coord: [number, number]) => void;
  /** Callback to set coordinate as route destination */
  setAsDestination?: (coord: [number, number]) => void;
}

/**
 * Execution context provided to registered commands containing application state and UI callbacks.
 */
export interface ActionContext {
  /** Current global application settings */
  settings: AppSettings;
  /** Callback to mutate application settings */
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  /** Currently active workflow mode */
  appMode: AppMode;
  /** Callback to change workflow mode */
  setAppMode: (mode: AppMode) => void;
  /** Sub-state for route planning */
  routing: ActionRoutingState;
  /** Sub-state for live navigation */
  navigation: ActionNavigationState;
  /** Sub-state for map canvas features */
  map: ActionMapState;
  /** Sub-state for places management */
  places: ActionPlacesState;
  /** Callback to display centralized settings modal with optional target category and key */
  openSettings: (category?: SettingCategory, highlightKey?: keyof AppSettings) => void;
  /** Optional callback to open the Search All dialog */
  openSearchAll?: (tab?: 'all' | 'actions' | 'settings' | 'places') => void;
}

/**
 * Metadata descriptor and executable handler for a discrete application action or command.
 */
export interface ActionDefinition {
  /** Unique action identifier */
  id: string;
  /** Display title for menus and search */
  title: string;
  /** Category partition name */
  category: string;
  /** Explanatory description */
  description?: string;
  /** Searchable keyword tags */
  keywords?: string[];
  /** Representative icon key name */
  icon?: string;
  /** Default keyboard shortcut display string */
  shortcut?: string;
  /** Quick boolean availability check */
  isAvailable: (ctx: ActionContext) => boolean;
  /** Returns explanation why action is disabled or null */
  availabilityReason: (ctx: ActionContext) => string | null;
  /** Full availability check returning structured status */
  checkAvailability: (ctx: ActionContext) => ActionAvailability;
  /** Primary execution handler */
  execute: (ctx: ActionContext) => void | Promise<void>;
  /** Alias for execute matching command patterns */
  perform: (ctx: ActionContext) => void | Promise<void>;
}
