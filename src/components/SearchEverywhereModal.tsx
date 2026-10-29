import React, { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { getAllActions } from '../core/actions/registry';
import type { ActionAvailability, ActionContext, ActionDefinition } from '../core/actions/types';
import type { AppSettings, SettingCategory } from '../core/config';
import { type SettingMetadataItem, SETTINGS_METADATA } from '../core/config/settingsMetadata';
import type { Landmark } from '../core/landmarks/types';
import { settingsStore, useSettings } from '../store/settingsStore';
import {
  ArrowUpDown,
  Bike,
  Compass,
  CornerUpRight,
  Footprints,
  GitFork,
  Info,
  Layers,
  MapPin,
  Palette,
  Play,
  RotateCcw,
  Route,
  Search,
  Settings,
  ShieldAlert,
  Square,
  Star,
  Trash2,
  Trees,
  Wifi,
  X,
  Zap,
  ZoomIn,
} from './common/Icon';

/**
 * Filter tabs available in the Search Everywhere modal.
 */
export type SearchTab = 'all' | 'actions' | 'settings' | 'places';

/**
 * Properties for SearchEverywhereModal component.
 */
export interface SearchEverywhereModalProps {
  /** Whether the modal is currently open and visible */
  isOpen: boolean;
  /** Callback fired to close the modal */
  onClose: () => void;
  /** Initial active filter tab */
  initialTab?: SearchTab;
  /** Action context providing current application state and triggers */
  actionContext: ActionContext;
  /** Callback to open settings modal with optional target category and key */
  onOpenSettings: (category?: SettingCategory, highlightKey?: keyof AppSettings) => void;
}

/**
 * Result entry for an executable application command.
 */
export interface ActionEntry {
  type: 'action';
  action: ActionDefinition;
  availability: ActionAvailability;
}

/**
 * Result entry for an application setting.
 */
export interface SettingEntry {
  type: 'setting';
  setting: SettingMetadataItem;
  currentValue: AppSettings[keyof AppSettings];
}

/**
 * Result entry for a saved place / landmark.
 */
export interface PlaceEntry {
  type: 'place';
  place: Landmark;
}

/**
 * Search result entry union across actions, settings, and places.
 */
export type SearchEntry = ActionEntry | SettingEntry | PlaceEntry;

const ACTION_ICON_MAP: Record<string, typeof Route> = {
  Route,
  Star,
  ShieldAlert,
  GitFork,
  ArrowUpDown,
  Trash2,
  Zap,
  Trees,
  Bike,
  Footprints,
  Play,
  Square,
  Compass,
  Layers,
  ZoomIn,
  Info,
  Settings,
  Palette,
  Wifi,
  RotateCcw,
  MapPin,
};

/**
 * Renders an icon for an action item.
 *
 * @param iconName - Name of the registered icon.
 * @returns ReactNode representing the icon.
 */
function renderActionIcon(iconName?: string): ReactNode {
  if (!iconName) return <Route size={16} />;
  const IconComponent = ACTION_ICON_MAP[iconName] ?? Route;
  return <IconComponent size={16} />;
}

/**
 * Renders an icon for a setting category.
 *
 * @param category - Category partition.
 * @returns ReactNode representing the icon.
 */
function renderSettingIcon(category: SettingCategory): ReactNode {
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
 * IntelliJ-style Search Everywhere and Find Action dialog component.
 * Allows lightning-fast fuzzy search and keyboard navigation across all modes,
 * routing operations, configuration settings, and saved places.
 *
 * @param props - Component properties.
 * @returns Rendered modal or null when closed.
 */
export const SearchEverywhereModal: React.FC<SearchEverywhereModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'all',
  actionContext,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const settings = useSettings();

  // Reset state when opening
  const [prevFilterState, setPrevFilterState] = useState({ isOpen, initialTab, activeTab, query });
  if (
    prevFilterState.isOpen !== isOpen ||
    prevFilterState.initialTab !== initialTab ||
    prevFilterState.activeTab !== activeTab ||
    prevFilterState.query !== query
  ) {
    const isOpening = !prevFilterState.isOpen && isOpen;
    const newActiveTab = isOpening ? initialTab : activeTab;
    const newQuery = isOpening ? '' : query;

    setPrevFilterState({
      isOpen,
      initialTab,
      activeTab: newActiveTab,
      query: newQuery,
    });

    if (isOpening) {
      setActiveTab(initialTab);
      setQuery('');
    }
    setSelectedIndex(0);
  }

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const allActions = useMemo(() => getAllActions(), []);

  // Compute filtered actions, settings, and places
  const filteredEntries = useMemo<SearchEntry[]>(() => {
    const q = query.trim().toLowerCase();

    const matchedActions: ActionEntry[] = [];
    if (activeTab === 'all' || activeTab === 'actions') {
      const actions = !q
        ? allActions
        : allActions.filter((a) => {
            if (a.title.toLowerCase().includes(q)) return true;
            if (a.category.toLowerCase().includes(q)) return true;
            if (a.description?.toLowerCase().includes(q)) return true;
            if (a.shortcut?.toLowerCase().includes(q)) return true;
            if (a.keywords?.some((kw) => kw.toLowerCase().includes(q))) return true;
            return false;
          });

      for (const action of actions) {
        matchedActions.push({
          type: 'action',
          action,
          availability: action.checkAvailability(actionContext),
        });
      }
    }

    const matchedSettings: SettingEntry[] = [];
    if (activeTab === 'all' || activeTab === 'settings') {
      const items = !q
        ? SETTINGS_METADATA
        : SETTINGS_METADATA.filter((s) => {
            if (s.label.toLowerCase().includes(q)) return true;
            if (s.categoryLabel.toLowerCase().includes(q)) return true;
            if (s.description?.toLowerCase().includes(q)) return true;
            if (s.key.toLowerCase().includes(q)) return true;
            if (s.keywords?.some((kw) => kw.toLowerCase().includes(q))) return true;
            return false;
          });

      for (const setting of items) {
        matchedSettings.push({
          type: 'setting',
          setting,
          currentValue: settings[setting.key],
        });
      }
    }

    const matchedPlaces: PlaceEntry[] = [];
    if (activeTab === 'all' || activeTab === 'places') {
      const places = actionContext.places?.places ?? [];
      const filtered = !q
        ? places
        : places.filter((p) => {
            if (p.name.toLowerCase().includes(q)) return true;
            if (p.description?.toLowerCase().includes(q)) return true;
            if (p.category.toLowerCase().includes(q)) return true;
            return false;
          });

      for (const place of filtered) {
        matchedPlaces.push({
          type: 'place',
          place,
        });
      }
    }

    if (activeTab === 'actions') return matchedActions;
    if (activeTab === 'settings') return matchedSettings;
    if (activeTab === 'places') return matchedPlaces;
    return [...matchedActions, ...matchedSettings, ...matchedPlaces];
  }, [activeTab, query, allActions, actionContext, settings]);

  // Keep selected index in bounds when list changes
  useEffect(() => {
    if (selectedIndex >= filteredEntries.length) {
      setSelectedIndex(Math.max(0, filteredEntries.length - 1));
    }
  }, [filteredEntries.length, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleCycleTab = (forward: boolean) => {
    const tabs: SearchTab[] = ['all', 'actions', 'settings', 'places'];
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = forward
      ? (currentIndex + 1) % tabs.length
      : (currentIndex - 1 + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex]);
  };

  const handleSelectEntry = (entry: SearchEntry) => {
    if (entry.type === 'action') {
      if (entry.availability.available) {
        entry.action.perform(actionContext);
        onClose();
      }
    } else if (entry.type === 'setting') {
      if (entry.setting.type === 'boolean') {
        const currVal = Boolean(settings[entry.setting.key]);
        settingsStore.updateSettings({ [entry.setting.key]: !currVal });
      } else {
        onOpenSettings(entry.setting.category, entry.setting.key);
        onClose();
      }
    } else if (entry.type === 'place') {
      actionContext.places.selectPlace?.(entry.place);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      handleCycleTab(!e.shiftKey);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredEntries.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredEntries.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredEntries.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredEntries.length) % filteredEntries.length);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const current = filteredEntries[selectedIndex];
      if (current) {
        handleSelectEntry(current);
      }
    }
  };

  return (
    <div
      className="ciclista-search-backdrop"
      onClick={onClose}
      data-testid="search-everywhere-modal"
    >
      <div
        className="ciclista-search-container"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-label="Search Everywhere"
        aria-modal="true"
      >
        {/* Header with Search Input and Tabs */}
        <div className="ciclista-search-header">
          <div className="ciclista-search-input-wrapper">
            <Search size={18} className="ciclista-search-input-icon" />
            <input
              ref={inputRef}
              type="text"
              className="ciclista-search-everywhere-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions, settings, places... (Tab to cycle tabs)"
              autoComplete="off"
              spellCheck="false"
              data-testid="search-everywhere-input"
            />
            {query && (
              <button
                type="button"
                className="ciclista-search-everywhere-clear"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear query"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="ciclista-search-tabs" role="tablist">
            {(['all', 'actions', 'settings', 'places'] as SearchTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`ciclista-search-tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                data-testid={`tab-${tab}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="ciclista-search-list" ref={listRef} role="listbox">
          {filteredEntries.length === 0 ? (
            <div className="ciclista-search-empty">
              No matching actions, settings, or places found
            </div>
          ) : (
            filteredEntries.map((entry, index) => {
              const isSelected = index === selectedIndex;

              if (entry.type === 'action') {
                const { action, availability } = entry;
                const isAvailable = availability.available;

                return (
                  <div
                    key={`action-${action.id}`}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    className={`ciclista-search-item ${isSelected ? 'selected' : ''} ${
                      !isAvailable ? 'disabled' : ''
                    }`}
                    onClick={() => handleSelectEntry(entry)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    data-testid={`result-action-${action.id}`}
                  >
                    <div className="ciclista-search-item-left">
                      <div className="ciclista-search-item-icon">
                        {renderActionIcon(action.icon)}
                      </div>
                      <div className="ciclista-search-item-info">
                        <div className="ciclista-search-item-title-row">
                          <span className="ciclista-search-item-title">{action.title}</span>
                          <span className="ciclista-search-badge">{action.category}</span>
                        </div>
                        {action.description && (
                          <div className="ciclista-search-item-desc">{action.description}</div>
                        )}
                      </div>
                    </div>

                    <div className="ciclista-search-item-right">
                      {action.shortcut && (
                        <kbd className="ciclista-search-shortcut">{action.shortcut}</kbd>
                      )}
                    </div>
                  </div>
                );
              }

              if (entry.type === 'setting') {
                const { setting, currentValue } = entry;
                const isBool = setting.type === 'boolean';

                return (
                  <div
                    key={`setting-${setting.key}`}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    className={`ciclista-search-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectEntry(entry)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    data-testid={`result-setting-${setting.key}`}
                  >
                    <div className="ciclista-search-item-left">
                      <div className="ciclista-search-item-icon">
                        {renderSettingIcon(setting.category)}
                      </div>
                      <div className="ciclista-search-item-info">
                        <div className="ciclista-search-item-title-row">
                          <span className="ciclista-search-item-title">{setting.label}</span>
                          <span className="ciclista-search-badge ciclista-search-badge--setting">
                            {setting.categoryLabel}
                          </span>
                        </div>
                        {setting.description && (
                          <div className="ciclista-search-item-desc">{setting.description}</div>
                        )}
                      </div>
                    </div>

                    <div className="ciclista-search-item-right">
                      {isBool ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(currentValue)}
                          className="ciclista-search-toggle-switch"
                          onClick={(e) => {
                            e.stopPropagation();
                            settingsStore.updateSettings({ [setting.key]: !currentValue });
                          }}
                          data-testid={`toggle-${setting.key}`}
                          title="Toggle setting"
                        >
                          <span className="ciclista-search-toggle-knob" />
                        </button>
                      ) : (
                        <span className="ciclista-search-setting-val">{String(currentValue)}</span>
                      )}

                      <button
                        type="button"
                        className="ciclista-search-open-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSettings(setting.category, setting.key);
                          onClose();
                        }}
                        title="Open in Settings"
                        data-testid={`open-settings-${setting.key}`}
                        aria-label={`Open ${setting.label} in Settings`}
                      >
                        <CornerUpRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              }

              // Place Entry
              const { place } = entry;
              return (
                <div
                  key={`place-${place.id}`}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  role="option"
                  aria-selected={isSelected}
                  className={`ciclista-search-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectEntry(entry)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  data-testid={`result-place-${place.id}`}
                >
                  <div className="ciclista-search-item-left">
                    <div className="ciclista-search-item-icon">
                      <MapPin size={16} />
                    </div>
                    <div className="ciclista-search-item-info">
                      <div className="ciclista-search-item-title-row">
                        <span className="ciclista-search-item-title">{place.name}</span>
                        <span className="ciclista-search-badge ciclista-search-badge--place">
                          {place.category}
                        </span>
                      </div>
                      {place.description && (
                        <div className="ciclista-search-item-desc">{place.description}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="ciclista-search-footer">
          <div className="ciclista-search-footer-hint">
            <kbd>↑</kbd> <kbd>↓</kbd> Navigate
          </div>
          <div className="ciclista-search-footer-hint">
            <kbd>↵</kbd> Select / Toggle
          </div>
          <div className="ciclista-search-footer-hint">
            <kbd>Tab</kbd> Switch Tab
          </div>
          <div className="ciclista-search-footer-hint">
            <kbd>Esc</kbd> Close
          </div>
        </div>
      </div>
    </div>
  );
};
