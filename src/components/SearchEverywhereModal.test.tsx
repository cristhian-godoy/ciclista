import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionContext } from '../core/actions/types';
import { DEFAULT_APP_SETTINGS } from '../core/config/settings';
import { settingsStore } from '../store/settingsStore';
import { SearchEverywhereModal } from './SearchEverywhereModal';

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
      places: [
        {
          id: 'place-1',
          name: 'Brandenburg Gate',
          coordinates: [52.5163, 13.3777],
          category: 'landmark',
          description: 'Historical monument',
        },
      ],
      selectPlace: vi.fn(),
    },
    openSettings: vi.fn(),
    openSearchAll: vi.fn(),
  };
}

describe('SearchEverywhereModal Component', () => {
  let mockContext: ActionContext;

  beforeEach(() => {
    localStorage.clear();
    settingsStore.resetSettings();
    mockContext = createMockActionContext();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <SearchEverywhereModal
        isOpen={false}
        onClose={vi.fn()}
        actionContext={mockContext}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('search-everywhere-modal')).not.toBeInTheDocument();
  });

  it('renders modal with tabs and search input when isOpen is true', () => {
    render(
      <SearchEverywhereModal
        isOpen={true}
        onClose={vi.fn()}
        actionContext={mockContext}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(screen.getByTestId('search-everywhere-modal')).toBeInTheDocument();
    expect(screen.getByTestId('search-everywhere-input')).toBeInTheDocument();
    expect(screen.getByTestId('tab-all')).toHaveClass('active');
    expect(screen.getByTestId('tab-actions')).toBeInTheDocument();
    expect(screen.getByTestId('tab-settings')).toBeInTheDocument();
    expect(screen.getByTestId('tab-places')).toBeInTheDocument();
  });

  it('filters actions, settings, and places in All tab', async () => {
    const user = userEvent.setup();
    render(
      <SearchEverywhereModal
        isOpen={true}
        onClose={vi.fn()}
        actionContext={mockContext}
        onOpenSettings={vi.fn()}
      />,
    );

    const input = screen.getByTestId('search-everywhere-input');
    await user.type(input, 'Brandenburg');

    expect(screen.getByTestId('result-place-place-1')).toBeInTheDocument();
    expect(screen.queryByTestId('result-action-routing.swap')).not.toBeInTheDocument();
  });

  it('filters by category tab when clicking tabs', async () => {
    const user = userEvent.setup();
    render(
      <SearchEverywhereModal
        isOpen={true}
        onClose={vi.fn()}
        actionContext={mockContext}
        onOpenSettings={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('tab-places'));
    expect(screen.getByTestId('tab-places')).toHaveClass('active');
    expect(screen.getByTestId('result-place-place-1')).toBeInTheDocument();
    expect(screen.queryByTestId('result-action-routing.swap')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('tab-actions'));
    expect(screen.getByTestId('result-action-routing.swap')).toBeInTheDocument();
    expect(screen.queryByTestId('result-place-place-1')).not.toBeInTheDocument();
  });

  it('executes action when clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <SearchEverywhereModal
        isOpen={true}
        onClose={handleClose}
        actionContext={mockContext}
        onOpenSettings={vi.fn()}
      />,
    );

    const swapAction = screen.getByTestId('result-action-routing.swap');
    await user.click(swapAction);

    expect(mockContext.routing.swapStartEnd).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('toggles boolean setting directly from list', async () => {
    const user = userEvent.setup();
    render(
      <SearchEverywhereModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="settings"
        actionContext={mockContext}
        onOpenSettings={vi.fn()}
      />,
    );

    const toggle = screen.getByTestId('toggle-freezePinsOnEditMode');
    expect(settingsStore.getSettings().freezePinsOnEditMode).toBe(true);

    await user.click(toggle);
    expect(settingsStore.getSettings().freezePinsOnEditMode).toBe(false);
  });

  it('deep-links into settings modal when open in settings button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleOpenSettings = vi.fn();

    render(
      <SearchEverywhereModal
        isOpen={true}
        onClose={handleClose}
        initialTab="settings"
        actionContext={mockContext}
        onOpenSettings={handleOpenSettings}
      />,
    );

    const openBtn = screen.getByTestId('open-settings-theme');
    await user.click(openBtn);

    expect(handleOpenSettings).toHaveBeenCalledWith('appearance', 'theme');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('cycles tabs with Tab key and closes with Escape key', () => {
    const handleClose = vi.fn();
    render(
      <SearchEverywhereModal
        isOpen={true}
        onClose={handleClose}
        actionContext={mockContext}
        onOpenSettings={vi.fn()}
      />,
    );

    const container = screen.getByTestId('search-everywhere-modal').firstElementChild!;

    // Tab key switches to 'actions'
    fireEvent.keyDown(container, { key: 'Tab' });
    expect(screen.getByTestId('tab-actions')).toHaveClass('active');

    // Escape key closes modal
    fireEvent.keyDown(container, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
