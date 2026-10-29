import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../config';
import { ACTIONS, getActionById, getAllActions, makeAction, searchActions } from './registry';
import type { ActionContext } from './types';

function createMockActionContext(): ActionContext {
  return {
    settings: { ...DEFAULT_APP_SETTINGS },
    updateSettings: vi.fn(),
    appMode: 'routing',
    setAppMode: vi.fn(),
    routing: {
      startCoord: [52.52, 13.405],
      endCoord: [52.53, 13.41],
      hasActiveRoute: true,
      routingStrategy: 'balanced',
      swapStartEnd: vi.fn(),
      clearRoute: vi.fn(),
      setRoutingStrategy: vi.fn(),
      setBikeConfig: vi.fn(),
    },
    navigation: {
      isNavigating: false,
      startNavigation: vi.fn(),
      stopNavigation: vi.fn(),
      toggleCameraMode: vi.fn(),
    },
    map: {
      showStreetGraph: true,
      toggleStreetGraph: vi.fn(),
      fitRouteBounds: vi.fn(),
      isInspectorActive: false,
      toggleInspector: vi.fn(),
    },
    places: {
      places: [],
      selectPlace: vi.fn(),
    },
    openSettings: vi.fn(),
    openSearchAll: vi.fn(),
  };
}

describe('actions registry', () => {
  it('registers all standard actions with valid availability checks', () => {
    const all = getAllActions();
    expect(all.length).toBeGreaterThan(15);

    const ctx = createMockActionContext();
    for (const action of all) {
      expect(action.id).toBeDefined();
      expect(action.title).toBeDefined();
      expect(typeof action.checkAvailability).toBe('function');
      const availability = action.checkAvailability(ctx);
      expect(typeof availability.available).toBe('boolean');
    }
  });

  it('searches actions by title, category, description, and keywords', () => {
    // Empty search returns all
    expect(searchActions('').length).toBe(ACTIONS.length);

    // Search by title
    const swap = searchActions('swap');
    expect(swap.some((a) => a.id === 'routing.swap')).toBe(true);

    // Search by keyword
    const nav = searchActions('simulate');
    expect(nav.some((a) => a.id === 'nav.start')).toBe(true);
  });

  it('executes routing.swap action and invokes context callback', () => {
    const ctx = createMockActionContext();
    const swapAction = getActionById('routing.swap');
    expect(swapAction).toBeDefined();
    expect(swapAction?.isAvailable(ctx)).toBe(true);

    swapAction?.perform(ctx);
    expect(ctx.routing.swapStartEnd).toHaveBeenCalledTimes(1);
  });

  it('disables nav.start when no active route is present', () => {
    const ctx = createMockActionContext();
    ctx.routing.hasActiveRoute = false;

    const startNav = getActionById('nav.start');
    const avail = startNav?.checkAvailability(ctx);
    expect(avail?.available).toBe(false);
    expect(avail?.reason).toContain('Calculate a route');
  });

  it('allows building custom actions with makeAction', () => {
    const custom = makeAction({
      id: 'custom.test',
      title: 'Test Command',
      category: 'Test',
      checkAvailability: () => ({ available: true }),
      perform: vi.fn(),
    });

    const ctx = createMockActionContext();
    expect(custom.isAvailable(ctx)).toBe(true);
    expect(custom.availabilityReason(ctx)).toBeNull();

    custom.execute(ctx);
    expect(custom.perform).toHaveBeenCalledWith(ctx);
  });
});
