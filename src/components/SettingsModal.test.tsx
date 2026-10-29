import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../core/config/settings';
import { settingsStore } from '../store/settingsStore';
import { SettingsModal } from './SettingsModal';

describe('SettingsModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    settingsStore.resetSettings();
  });

  it('renders nothing when isOpen is false', () => {
    render(<SettingsModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  it('renders modal with default appearance category when isOpen is true', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByTestId('settings-tab-appearance')).toHaveClass('active');
    expect(screen.getByTestId('select-theme')).toBeInTheDocument();
  });

  it('switches categories when sidebar items are clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await user.click(screen.getByTestId('settings-tab-map'));
    expect(screen.getByTestId('settings-tab-map')).toHaveClass('active');
    expect(screen.getByTestId('checkbox-freezePinsOnEditMode')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-showStreetGraph')).toBeInTheDocument();

    await user.click(screen.getByTestId('settings-tab-network'));
    expect(screen.getByTestId('checkbox-dataSaver')).toBeInTheDocument();

    await user.click(screen.getByTestId('settings-tab-routing'));
    expect(screen.getByTestId('select-defaultBikeProfile')).toBeInTheDocument();

    await user.click(screen.getByTestId('settings-tab-backup'));
    expect(screen.getByTestId('export-settings-btn')).toBeInTheDocument();
    expect(screen.getByTestId('reset-settings-defaults-btn')).toBeInTheDocument();
  });

  it('stages changes locally and applies only upon Apply or OK', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={handleClose} initialCategory="map" />);

    const freezeCheckbox = screen.getByTestId('checkbox-freezePinsOnEditMode');
    expect(freezeCheckbox).toBeChecked();

    // Toggle freezePinsOnEditMode
    await user.click(freezeCheckbox);
    expect(freezeCheckbox).not.toBeChecked();

    // Store is NOT updated yet
    expect(settingsStore.getSettings().freezePinsOnEditMode).toBe(true);

    // Click Apply
    await user.click(screen.getByTestId('settings-apply-btn'));
    expect(settingsStore.getSettings().freezePinsOnEditMode).toBe(false);
    expect(handleClose).not.toHaveBeenCalled();

    // Toggle again and click OK
    await user.click(freezeCheckbox);
    await user.click(screen.getByTestId('settings-ok-btn'));
    expect(settingsStore.getSettings().freezePinsOnEditMode).toBe(true);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('discards staged changes when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={handleClose} initialCategory="map" />);

    const freezeCheckbox = screen.getByTestId('checkbox-freezePinsOnEditMode');
    await user.click(freezeCheckbox);
    expect(freezeCheckbox).not.toBeChecked();

    await user.click(screen.getByTestId('settings-cancel-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(settingsStore.getSettings().freezePinsOnEditMode).toBe(true);
  });

  it('filters settings by search query in real time', async () => {
    const user = userEvent.setup();
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const searchInput = screen.getByTestId('settings-search-input');
    await user.type(searchInput, 'freeze');

    expect(screen.getByTestId('checkbox-freezePinsOnEditMode')).toBeInTheDocument();
    expect(screen.queryByTestId('select-theme')).not.toBeInTheDocument();
  });

  it('supports deep-linking to category and highlight key', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} highlightKey="freezePinsOnEditMode" />);

    expect(screen.getByTestId('settings-tab-map')).toHaveClass('active');
    const targetRow = document.querySelector('[data-setting-key="freezePinsOnEditMode"]');
    expect(targetRow).toHaveClass('ciclista-setting-highlighted');
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('resets staged settings to defaults from backup tab', async () => {
    const user = userEvent.setup();
    settingsStore.updateSettings({ theme: 'dark' });
    render(<SettingsModal isOpen={true} onClose={vi.fn()} initialCategory="backup" />);

    await user.click(screen.getByTestId('reset-settings-defaults-btn'));
    expect(screen.getByTestId('backup-status-banner')).toHaveTextContent(
      'Settings reset to defaults',
    );

    await user.click(screen.getByTestId('settings-apply-btn'));
    expect(settingsStore.getSettings().theme).toBe(DEFAULT_APP_SETTINGS.theme);
  });
});
