import React, { type ReactNode, useEffect, useRef, useState } from 'react';

import { type AppSettings, DEFAULT_APP_SETTINGS } from '../core/config/settings';
import type { SettingCategory } from '../core/config/settingsMetadata';
import {
  CATEGORY_LABELS,
  getSettingMetadata,
  searchSettings,
  SETTING_CATEGORY_MAP,
} from '../core/config/settingsMetadata';
import { exportSettingsJson, importSettingsJson } from '../core/storage/settingsStorage';
import { settingsStore, useSettings } from '../store/settingsStore';
import {
  Copy,
  Download,
  Layers,
  Palette,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Wifi,
  X,
} from './common/Icon';

export type { SettingCategory };

/**
 * Properties for the SettingsModal component.
 */
export interface SettingsModalProps {
  /** Whether the modal is currently rendered and visible */
  isOpen: boolean;
  /** Callback fired to close the modal */
  onClose: () => void;
  /** Optional initial category to display upon opening */
  initialCategory?: SettingCategory;
  /** Optional setting key to scroll to and highlight upon opening */
  highlightKey?: keyof AppSettings;
}

/**
 * Renders the category icon based on the category identifier.
 *
 * @param category - The setting category identifier.
 * @returns ReactNode representing the icon.
 */
function renderCategoryIcon(category: SettingCategory): ReactNode {
  switch (category) {
    case 'appearance':
      return <Palette size={16} />;
    case 'map':
      return <Layers size={16} />;
    case 'network':
      return <Wifi size={16} />;
    case 'routing':
      return <Route size={16} />;
    case 'backup':
      return <RotateCcw size={16} />;
  }
}

/**
 * IntelliJ-style split-view centralized settings modal for Ciclista.
 * Features categorized navigation, real-time keyword search, local staging (OK/Apply/Cancel),
 * and deep-linking with auto-scrolling highlight animations.
 *
 * @param props - Component properties.
 * @returns Rendered modal element or null when closed.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialCategory,
  highlightKey,
}) => {
  const settings = useSettings();

  const [activeCategory, setActiveCategory] = useState<SettingCategory>(() => {
    if (initialCategory) return initialCategory;
    if (highlightKey) return SETTING_CATEGORY_MAP[highlightKey];
    return 'appearance';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [localSettings, setLocalSettings] = useState<AppSettings>(() => ({ ...settings }));
  const [highlightedKey, setHighlightedKey] = useState<keyof AppSettings | null>(
    () => highlightKey ?? null,
  );
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync state when modal open state or deep-link targets change
  const [prevProps, setPrevProps] = useState({ isOpen, initialCategory, highlightKey });
  if (
    prevProps.isOpen !== isOpen ||
    prevProps.initialCategory !== initialCategory ||
    prevProps.highlightKey !== highlightKey
  ) {
    setPrevProps({ isOpen, initialCategory, highlightKey });
    if (isOpen) {
      setLocalSettings({ ...settingsStore.getSettings() });
      setActiveCategory(
        initialCategory ?? (highlightKey ? SETTING_CATEGORY_MAP[highlightKey] : 'appearance'),
      );
      setHighlightedKey(highlightKey ?? null);
      setSearchQuery('');
      setBackupMessage(null);
    }
  }

  // Handle escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle deep-link scrolling and highlight decay
  useEffect(() => {
    if (!isOpen || !highlightKey) return;

    const timer = setTimeout(() => {
      setHighlightedKey(null);
    }, 2500);

    const scrollTimer = setTimeout(() => {
      const targetElement = document.querySelector(`[data-setting-key="${highlightKey}"]`);
      if (targetElement && typeof targetElement.scrollIntoView === 'function') {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);

    return () => {
      clearTimeout(timer);
      clearTimeout(scrollTimer);
    };
  }, [isOpen, highlightKey]);

  if (!isOpen) return null;

  const handleCategoryChange = (category: SettingCategory) => {
    setActiveCategory(category);
    setHighlightedKey(null);
    setSearchQuery('');
  };

  const handleUpdateLocal = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setHighlightedKey(null);
    setLocalSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApply = () => {
    settingsStore.updateSettings(localSettings);
  };

  const handleOk = () => {
    settingsStore.updateSettings(localSettings);
    onClose();
  };

  const handleExportJson = () => {
    const json = exportSettingsJson(localSettings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciclista-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage('Settings configuration exported successfully.');
  };

  const handleCopyJson = async () => {
    try {
      const json = exportSettingsJson(localSettings);
      await navigator.clipboard.writeText(json);
      setBackupMessage('Settings configuration copied to clipboard.');
    } catch {
      setBackupMessage('Unable to copy settings to clipboard.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const imported = importSettingsJson(content);
      if (imported) {
        setLocalSettings(imported);
        setBackupMessage('Settings imported successfully.');
      } else {
        setBackupMessage('Invalid configuration file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetToDefaults = () => {
    setLocalSettings({ ...DEFAULT_APP_SETTINGS });
    setBackupMessage('Settings reset to defaults. Click OK or Apply to commit.');
  };

  const filteredMetadata = searchQuery ? searchSettings(searchQuery) : [];

  return (
    <div
      className="ciclista-settings-backdrop"
      onClick={onClose}
      data-testid="settings-modal-backdrop"
    >
      <div
        className="ciclista-settings-container"
        onClick={(e) => e.stopPropagation()}
        data-testid="settings-modal"
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
      >
        {/* Header */}
        <div className="ciclista-settings-header">
          <div className="ciclista-settings-title-group">
            <h2 className="ciclista-settings-title">Settings</h2>
            <span className="ciclista-settings-subtitle">System & Application Preferences</span>
          </div>
          <button
            type="button"
            className="ciclista-modal-close-btn"
            onClick={onClose}
            aria-label="Close Settings"
            title="Close Settings (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ciclista-settings-body">
          {/* Left Category Sidebar */}
          <nav className="ciclista-settings-sidebar" aria-label="Settings Categories">
            <div className="ciclista-settings-sidebar-group-title">Preferences</div>

            {(['appearance', 'map', 'network', 'routing', 'backup'] as SettingCategory[]).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`ciclista-settings-sidebar-item ${
                    activeCategory === cat && !searchQuery ? 'active' : ''
                  }`}
                  onClick={() => handleCategoryChange(cat)}
                  data-testid={`settings-tab-${cat}`}
                >
                  <span className="ciclista-settings-sidebar-icon">{renderCategoryIcon(cat)}</span>
                  <span>{CATEGORY_LABELS[cat]}</span>
                </button>
              ),
            )}
          </nav>

          {/* Right Content Pane */}
          <div className="ciclista-settings-content">
            {/* Search filter bar */}
            <div className="ciclista-settings-search-bar">
              <Search size={16} className="ciclista-settings-search-icon" />
              <input
                ref={searchInputRef}
                id="ciclista-settings-search-input"
                name="settingsSearch"
                aria-label="Filter settings by keyword"
                type="text"
                className="ciclista-input ciclista-settings-search-input"
                placeholder="Filter settings by keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="settings-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="ciclista-settings-search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Content view: Search Results or Category Panel */}
            {searchQuery ? (
              <div className="ciclista-settings-search-results">
                <div className="ciclista-settings-section-header">
                  Matching Settings ({filteredMetadata.length})
                </div>
                {filteredMetadata.length === 0 ? (
                  <div className="ciclista-settings-empty">
                    No settings match &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  filteredMetadata.map((meta) => (
                    <SettingFormRow
                      key={meta.key}
                      meta={meta}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === meta.key}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="ciclista-settings-category-panel">
                <div className="ciclista-settings-section-header">
                  {CATEGORY_LABELS[activeCategory]}
                </div>

                {activeCategory === 'appearance' && (
                  <div className="ciclista-settings-group">
                    <SettingFormRow
                      meta={getSettingMetadata('theme')!}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === 'theme'}
                    />
                  </div>
                )}

                {activeCategory === 'map' && (
                  <div className="ciclista-settings-group">
                    <SettingFormRow
                      meta={getSettingMetadata('freezePinsOnEditMode')!}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === 'freezePinsOnEditMode'}
                    />
                    <SettingFormRow
                      meta={getSettingMetadata('autoCollapseCrossingClusters')!}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === 'autoCollapseCrossingClusters'}
                    />
                    <SettingFormRow
                      meta={getSettingMetadata('showStreetGraph')!}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === 'showStreetGraph'}
                    />
                    <SettingFormRow
                      meta={getSettingMetadata('showTrafficSignals')!}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === 'showTrafficSignals'}
                    />
                  </div>
                )}

                {activeCategory === 'network' && (
                  <div className="ciclista-settings-group">
                    <SettingFormRow
                      meta={getSettingMetadata('dataSaver')!}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === 'dataSaver'}
                    />
                    <SettingFormRow
                      meta={getSettingMetadata('allowCellularDownloads')!}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === 'allowCellularDownloads'}
                    />
                  </div>
                )}

                {activeCategory === 'routing' && (
                  <div className="ciclista-settings-group">
                    <SettingFormRow
                      meta={getSettingMetadata('defaultBikeProfile')!}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === 'defaultBikeProfile'}
                    />
                    <SettingFormRow
                      meta={getSettingMetadata('defaultRoutingStrategy')!}
                      localSettings={localSettings}
                      onUpdate={handleUpdateLocal}
                      isHighlighted={highlightedKey === 'defaultRoutingStrategy'}
                    />
                  </div>
                )}

                {activeCategory === 'backup' && (
                  <div className="ciclista-settings-group ciclista-settings-backup-panel">
                    <p className="ciclista-settings-desc">
                      Export your preferences and local overrides to a portable JSON backup file, or
                      restore a previously exported configuration.
                    </p>

                    <div className="ciclista-settings-action-row">
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary"
                        onClick={handleExportJson}
                        data-testid="export-settings-btn"
                      >
                        <Download size={14} />
                        Export JSON Backup
                      </button>

                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary"
                        onClick={handleCopyJson}
                        data-testid="copy-settings-btn"
                      >
                        <Copy size={14} />
                        Copy JSON to Clipboard
                      </button>

                      <input
                        ref={fileInputRef}
                        id="import-settings-file"
                        name="importSettingsFile"
                        aria-label="Import JSON Configuration file"
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={handleImportFile}
                        data-testid="import-settings-file"
                      />

                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--secondary"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="import-settings-btn"
                      >
                        <RefreshCw size={14} />
                        Import JSON Configuration
                      </button>
                    </div>

                    <div className="ciclista-settings-danger-zone">
                      <div className="ciclista-settings-danger-title">Reset Configuration</div>
                      <p className="ciclista-settings-desc">
                        Revert all application settings to original system defaults.
                      </p>
                      <button
                        type="button"
                        className="ciclista-btn ciclista-btn--danger"
                        onClick={handleResetToDefaults}
                        data-testid="reset-settings-defaults-btn"
                      >
                        <RotateCcw size={14} />
                        Reset All to Defaults
                      </button>
                    </div>

                    {backupMessage && (
                      <div
                        className="ciclista-settings-status-banner"
                        data-testid="backup-status-banner"
                      >
                        {backupMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="ciclista-settings-footer">
          <button
            type="button"
            className="ciclista-btn ciclista-btn--secondary"
            onClick={onClose}
            data-testid="settings-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="ciclista-btn ciclista-btn--secondary"
            onClick={handleApply}
            data-testid="settings-apply-btn"
          >
            Apply
          </button>
          <button
            type="button"
            className="ciclista-btn ciclista-btn--primary"
            onClick={handleOk}
            data-testid="settings-ok-btn"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

interface SettingFormRowProps<K extends keyof AppSettings> {
  meta: ReturnType<typeof getSettingMetadata<K>> & object;
  localSettings: AppSettings;
  onUpdate: <T extends keyof AppSettings>(key: T, value: AppSettings[T]) => void;
  isHighlighted: boolean;
}

function SettingFormRow<K extends keyof AppSettings>({
  meta,
  localSettings,
  onUpdate,
  isHighlighted,
}: SettingFormRowProps<K>) {
  const value = localSettings[meta.key as keyof AppSettings];

  if (meta.type === 'boolean') {
    const isChecked = Boolean(value);
    return (
      <div
        className={`ciclista-settings-row ciclista-settings-row--checkbox ${
          isHighlighted ? 'ciclista-setting-highlighted setting-highlighted' : ''
        }`}
        data-setting-key={meta.key}
        onClick={() => onUpdate(meta.key as keyof AppSettings, !isChecked as never)}
      >
        <div className="ciclista-settings-checkbox-wrapper">
          <input
            id={`setting-${meta.key}`}
            name={meta.key}
            aria-label={meta.label}
            type="checkbox"
            className="ciclista-checkbox"
            checked={isChecked}
            onChange={(e) => onUpdate(meta.key as keyof AppSettings, e.target.checked as never)}
            onClick={(e) => e.stopPropagation()}
            data-testid={`checkbox-${meta.key}`}
          />
        </div>
        <div className="ciclista-settings-row-info">
          <label
            htmlFor={`setting-${meta.key}`}
            className="ciclista-settings-label"
            onClick={(e) => e.stopPropagation()}
          >
            {meta.label}
          </label>
          <span className="ciclista-settings-desc">{meta.description}</span>
        </div>
      </div>
    );
  }

  if (meta.type === 'enum' && meta.options) {
    return (
      <div
        className={`ciclista-settings-row ${
          isHighlighted ? 'ciclista-setting-highlighted setting-highlighted' : ''
        }`}
        data-setting-key={meta.key}
      >
        <div className="ciclista-settings-row-info">
          <label htmlFor={`setting-${meta.key}`} className="ciclista-settings-label">
            {meta.label}
          </label>
          <span className="ciclista-settings-desc">{meta.description}</span>
        </div>
        <select
          id={`setting-${meta.key}`}
          name={meta.key}
          aria-label={meta.label}
          className="ciclista-select ciclista-settings-select"
          value={String(value)}
          onChange={(e) => onUpdate(meta.key as keyof AppSettings, e.target.value as never)}
          data-testid={`select-${meta.key}`}
        >
          {meta.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return null;
}
