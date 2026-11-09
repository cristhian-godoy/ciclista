import type { BikeProfileId } from '../config/types';
import type { ActionContext, ActionDefinition } from './types';

/**
 * Helper to construct an ActionDefinition ensuring synchronization between
 * checkAvailability, isAvailable, perform, and execute.
 *
 * @param def - Action definition properties.
 * @returns Fully populated ActionDefinition instance.
 */
export function makeAction(
  def: Omit<ActionDefinition, 'isAvailable' | 'availabilityReason' | 'execute'> & {
    isAvailable?: (ctx: ActionContext) => boolean;
    availabilityReason?: (ctx: ActionContext) => string | null;
    execute?: (ctx: ActionContext) => void | Promise<void>;
  },
): ActionDefinition {
  const isAvailable = (ctx: ActionContext) => {
    const res = def.checkAvailability(ctx);
    return res.available;
  };

  const availabilityReason = (ctx: ActionContext) => {
    const res = def.checkAvailability(ctx);
    return res.reason ?? null;
  };

  const perform = def.perform;
  const execute = def.execute ?? perform;

  return {
    ...def,
    isAvailable,
    availabilityReason,
    perform,
    execute,
  };
}

/**
 * Global static registry of executable Ciclista application actions and commands.
 */
export const ACTIONS: ActionDefinition[] = [
  // ─── Mode Switching Actions ──────────────────────────────────────────────────
  makeAction({
    id: 'mode.routing',
    title: 'Switch to Routing Mode',
    category: 'Modes',
    description: 'Enter route planning mode to calculate bike paths between points',
    shortcut: '1',
    keywords: ['routing', 'directions', 'plan', 'navigate', 'mode'],
    icon: 'Route',
    checkAvailability: (ctx) => ({
      available: ctx.appMode !== 'routing',
      reason: ctx.appMode === 'routing' ? 'Already in Routing Mode' : undefined,
    }),
    perform: (ctx) => {
      ctx.setAppMode('routing');
    },
  }),
  makeAction({
    id: 'mode.places',
    title: 'Switch to Places Mode',
    category: 'Modes',
    description: 'Inspect, manage, and navigate to saved landmarks and places',
    shortcut: '2',
    keywords: ['places', 'landmarks', 'favorites', 'saved', 'waypoints', 'mode'],
    icon: 'Star',
    checkAvailability: (ctx) => ({
      available: ctx.appMode !== 'places',
      reason: ctx.appMode === 'places' ? 'Already in Places Mode' : undefined,
    }),
    perform: (ctx) => {
      ctx.setAppMode('places');
    },
  }),
  makeAction({
    id: 'mode.events',
    title: 'Switch to Events Mode',
    category: 'Modes',
    description: 'View active traffic delays, road blocks, and calendar studio events',
    shortcut: '3',
    keywords: ['events', 'calendar', 'zones', 'delays', 'blocks', 'mode'],
    icon: 'ShieldAlert',
    checkAvailability: (ctx) => ({
      available: ctx.appMode !== 'events',
      reason: ctx.appMode === 'events' ? 'Already in Events Mode' : undefined,
    }),
    perform: (ctx) => {
      ctx.setAppMode('events');
    },
  }),
  makeAction({
    id: 'mode.edit',
    title: 'Switch to Edit Mode',
    category: 'Modes',
    description: 'Edit crossing clusters, turn delay rules, and street network overrides',
    shortcut: '4',
    keywords: ['edit', 'network', 'crossings', 'clusters', 'turn', 'mode'],
    icon: 'GitFork',
    checkAvailability: (ctx) => ({
      available: ctx.appMode !== 'edit',
      reason: ctx.appMode === 'edit' ? 'Already in Edit Mode' : undefined,
    }),
    perform: (ctx) => {
      ctx.setAppMode('edit');
    },
  }),
  makeAction({
    id: 'mode.debug',
    title: 'Switch to Debug Mode',
    category: 'Modes',
    description: 'Inspect cached network chunks and route edge costs',
    shortcut: '5',
    keywords: ['debug', 'chunks', 'cache', 'edges', 'mode'],
    icon: 'Bug',
    checkAvailability: (ctx) => ({
      available: ctx.appMode !== 'debug',
      reason: ctx.appMode === 'debug' ? 'Already in Debug Mode' : undefined,
    }),
    perform: (ctx) => {
      ctx.setAppMode('debug');
    },
  }),

  // ─── Routing Actions ─────────────────────────────────────────────────────────
  makeAction({
    id: 'routing.swap',
    title: 'Swap Origin & Destination',
    category: 'Routing',
    description: 'Invert start point A and destination point B',
    shortcut: 'X',
    keywords: ['swap', 'reverse', 'endpoints', 'invert', 'start', 'end'],
    icon: 'ArrowUpDown',
    checkAvailability: (ctx) => {
      const hasBoth = Boolean(ctx?.routing?.startCoord && ctx?.routing?.endCoord);
      return {
        available: hasBoth,
        reason: hasBoth ? undefined : 'Requires both start and destination points',
      };
    },
    perform: (ctx) => {
      ctx?.routing?.swapStartEnd?.();
    },
  }),
  makeAction({
    id: 'routing.clear',
    title: 'Clear Active Route',
    category: 'Routing',
    description: 'Clear calculated route path and reset waypoints',
    keywords: ['clear', 'reset', 'route', 'remove', 'clean'],
    icon: 'Trash2',
    checkAvailability: (ctx) => {
      const hasSomething = Boolean(
        ctx?.routing?.hasActiveRoute || ctx?.routing?.startCoord || ctx?.routing?.endCoord,
      );
      return {
        available: hasSomething,
        reason: hasSomething ? undefined : 'No active route to clear',
      };
    },
    perform: (ctx) => {
      ctx?.routing?.clearRoute?.();
    },
  }),
  makeAction({
    id: 'routing.strategy.balanced',
    title: 'Routing Strategy: Balanced',
    category: 'Routing',
    description: 'Optimize route balancing travel time, infrastructure safety, and turn counts',
    keywords: ['strategy', 'balanced', 'routing', 'optimal'],
    icon: 'Route',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.routing.setRoutingStrategy?.('balanced');
      ctx.updateSettings({ defaultRoutingStrategy: 'balanced' });
    },
  }),
  makeAction({
    id: 'routing.strategy.fastest',
    title: 'Routing Strategy: Fastest',
    category: 'Routing',
    description: 'Optimize route strictly prioritizing minimum travel time and road velocity',
    keywords: ['strategy', 'fastest', 'speed', 'quick', 'routing'],
    icon: 'Zap',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.routing.setRoutingStrategy?.('fastest');
      ctx.updateSettings({ defaultRoutingStrategy: 'fastest' });
    },
  }),
  makeAction({
    id: 'routing.strategy.safe',
    title: 'Routing Strategy: Safe',
    category: 'Routing',
    description: 'Optimize route maximizing protected bike paths and segregated cycle tracks',
    keywords: ['strategy', 'safe', 'safety', 'protected', 'cycleway'],
    icon: 'ShieldAlert',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.routing.setRoutingStrategy?.('safe');
      ctx.updateSettings({ defaultRoutingStrategy: 'safe' });
    },
  }),
  makeAction({
    id: 'routing.strategy.scenic',
    title: 'Routing Strategy: Scenic',
    category: 'Routing',
    description: 'Optimize route favoring parks, waterfronts, and quiet residential corridors',
    keywords: ['strategy', 'scenic', 'quiet', 'park', 'leisure'],
    icon: 'Trees',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.routing.setRoutingStrategy?.('scenic');
      ctx.updateSettings({ defaultRoutingStrategy: 'scenic' });
    },
  }),
  makeAction({
    id: 'routing.bike.normal',
    title: 'Bike Profile: City Bike (Normal)',
    category: 'Routing',
    description: 'Configure router with 15 km/h standard urban bicycle velocity baseline',
    keywords: ['bike', 'profile', 'normal', 'city', 'bicycle'],
    icon: 'Bike',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      const id: BikeProfileId = 'normal';
      ctx.routing.setBikeConfig?.({ id });
      ctx.updateSettings({ defaultBikeProfile: id });
    },
  }),
  makeAction({
    id: 'routing.bike.road',
    title: 'Bike Profile: Road Bike',
    category: 'Routing',
    description:
      'Configure router with 25 km/h road cycling velocity baseline and asphalt priority',
    keywords: ['bike', 'profile', 'road', 'racing', 'fast'],
    icon: 'Bike',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      const id: BikeProfileId = 'road';
      ctx.routing.setBikeConfig?.({ id });
      ctx.updateSettings({ defaultBikeProfile: id });
    },
  }),
  makeAction({
    id: 'routing.bike.ebike',
    title: 'Bike Profile: E-Bike',
    category: 'Routing',
    description: 'Configure router with electric assist speed and reduced incline penalties',
    keywords: ['bike', 'profile', 'ebike', 'electric', 'battery'],
    icon: 'Zap',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      const id: BikeProfileId = 'ebike';
      ctx.routing.setBikeConfig?.({ id });
      ctx.updateSettings({ defaultBikeProfile: id });
    },
  }),
  makeAction({
    id: 'routing.bike.slow',
    title: 'Bike Profile: Leisure / Slow',
    category: 'Routing',
    description: 'Configure router with 10 km/h relaxed riding velocity baseline',
    keywords: ['bike', 'profile', 'slow', 'leisure', 'walking'],
    icon: 'Footprints',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      const id: BikeProfileId = 'slow';
      ctx.routing.setBikeConfig?.({ id });
      ctx.updateSettings({ defaultBikeProfile: id });
    },
  }),

  // ─── Navigation Actions ──────────────────────────────────────────────────────
  makeAction({
    id: 'nav.start',
    title: 'Start Navigation Simulation',
    category: 'Navigation',
    description: 'Launch simulated journey replay along the active route',
    keywords: ['navigate', 'navigation', 'simulation', 'start', 'drive', 'ride'],
    icon: 'Play',
    checkAvailability: (ctx) => {
      if (ctx?.navigation?.isNavigating) {
        return { available: false, reason: 'Navigation simulation already active' };
      }
      if (!ctx?.routing?.hasActiveRoute) {
        return { available: false, reason: 'Calculate a route before starting navigation' };
      }
      return { available: true };
    },
    perform: (ctx) => {
      ctx?.navigation?.startNavigation?.();
    },
  }),
  makeAction({
    id: 'nav.stop',
    title: 'Stop Navigation',
    category: 'Navigation',
    description: 'Stop simulated or turn-by-turn journey tracking',
    keywords: ['stop', 'end', 'navigation', 'finish', 'exit'],
    icon: 'Square',
    checkAvailability: (ctx) => ({
      available: Boolean(ctx?.navigation?.isNavigating),
      reason: ctx?.navigation?.isNavigating ? undefined : 'No active navigation session',
    }),
    perform: (ctx) => {
      ctx?.navigation?.stopNavigation?.();
    },
  }),
  makeAction({
    id: 'nav.toggleCamera',
    title: 'Toggle Camera Follow Mode',
    category: 'Navigation',
    description: 'Switch between North-Up 2D and Heading-Up 3D follow camera',
    keywords: ['camera', 'heading', 'north', '3d', 'follow', 'view'],
    icon: 'Compass',
    checkAvailability: (ctx) => ({
      available: Boolean(ctx?.navigation?.isNavigating),
      reason: ctx?.navigation?.isNavigating ? undefined : 'Available during active navigation',
    }),
    perform: (ctx) => {
      ctx?.navigation?.toggleCameraMode?.();
    },
  }),

  // ─── Map Canvas Actions ──────────────────────────────────────────────────────
  makeAction({
    id: 'map.toggleStreetGraph',
    title: 'Toggle Street Graph Overlay',
    category: 'Map',
    description: 'Toggle visibility of street graph edges and nodes on the map canvas',
    keywords: ['street', 'graph', 'layer', 'edges', 'overlay'],
    icon: 'Layers',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx?.map?.toggleStreetGraph?.();
    },
  }),
  makeAction({
    id: 'map.fitRoute',
    title: 'Fit Map to Route Bounds',
    category: 'Map',
    description: 'Zoom and pan the map viewport to frame the entire calculated route',
    keywords: ['fit', 'bounds', 'zoom', 'frame', 'extent'],
    icon: 'ZoomIn',
    checkAvailability: (ctx) => ({
      available: Boolean(ctx?.routing?.hasActiveRoute),
      reason: ctx?.routing?.hasActiveRoute ? undefined : 'Requires an active route',
    }),
    perform: (ctx) => {
      ctx?.map?.fitRouteBounds?.();
    },
  }),
  makeAction({
    id: 'map.toggleInspector',
    title: 'Toggle Inspector Mode',
    category: 'Map',
    description: 'Inspect OSM edge tags, speed limits, and node attributes on map click',
    keywords: ['inspector', 'inspect', 'tags', 'osm', 'attributes'],
    icon: 'Info',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx?.map?.toggleInspector?.();
    },
  }),

  // ─── Settings Actions ────────────────────────────────────────────────────────
  makeAction({
    id: 'settings.open',
    title: 'Open Settings',
    category: 'Settings',
    description: 'Open the centralized application settings and configuration modal',
    shortcut: 'Ctrl+,',
    keywords: ['settings', 'preferences', 'config', 'options', 'modal'],
    icon: 'Settings',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.openSettings();
    },
  }),
  makeAction({
    id: 'settings.appearance',
    title: 'Open Appearance & Theme Settings',
    category: 'Settings',
    description: 'Configure UI color theme (Bright, Liberty, Dark)',
    keywords: ['appearance', 'theme', 'dark', 'bright', 'color'],
    icon: 'Palette',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.openSettings('appearance', 'theme');
    },
  }),
  makeAction({
    id: 'settings.map',
    title: 'Open Map & Editor Settings',
    category: 'Settings',
    description: 'Configure freeze pins on edit mode, crossing clusters, and overlays',
    keywords: ['freeze', 'pins', 'map', 'editor', 'crossings', 'clusters'],
    icon: 'Layers',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.openSettings('map', 'freezePinsOnEditMode');
    },
  }),
  makeAction({
    id: 'settings.network',
    title: 'Open Network & Cache Settings',
    category: 'Settings',
    description: 'Configure data saver policy and cellular downloads',
    keywords: ['network', 'cache', 'data', 'saver', 'cellular'],
    icon: 'Wifi',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.openSettings('network', 'dataSaver');
    },
  }),
  makeAction({
    id: 'settings.routing',
    title: 'Open Routing Defaults Settings',
    category: 'Settings',
    description: 'Configure default bike profile and route optimization strategy',
    keywords: ['routing', 'defaults', 'bike', 'strategy', 'profile'],
    icon: 'Route',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.openSettings('routing', 'defaultRoutingStrategy');
    },
  }),
  makeAction({
    id: 'settings.backup',
    title: 'Open Backup & Reset Settings',
    category: 'Settings',
    description: 'Export or import JSON backup configurations and reset settings',
    keywords: ['backup', 'reset', 'export', 'import', 'restore'],
    icon: 'RotateCcw',
    checkAvailability: () => ({ available: true }),
    perform: (ctx) => {
      ctx.openSettings('backup');
    },
  }),
];

/**
 * Returns a clone of all registered application actions.
 *
 * @returns Array of ActionDefinition descriptors.
 */
export function getAllActions(): ActionDefinition[] {
  return [...ACTIONS];
}

/**
 * Retrieves a specific action by unique identifier.
 *
 * @param id - Action identifier.
 * @returns ActionDefinition or undefined if not registered.
 */
export function getActionById(id: string): ActionDefinition | undefined {
  return ACTIONS.find((a) => a.id === id);
}

/**
 * Searches actions matching query against title, category, description, shortcut, or keywords.
 *
 * @param query - Search string query.
 * @returns Filtered array of matching ActionDefinition objects.
 */
export function searchActions(query: string): ActionDefinition[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [...ACTIONS];
  }

  return ACTIONS.filter((action) => {
    if (action.title.toLowerCase().includes(trimmed)) return true;
    if (action.category.toLowerCase().includes(trimmed)) return true;
    if (action.description?.toLowerCase().includes(trimmed)) return true;
    if (action.shortcut?.toLowerCase().includes(trimmed)) return true;
    if (action.keywords?.some((k) => k.toLowerCase().includes(trimmed))) return true;
    return false;
  });
}
