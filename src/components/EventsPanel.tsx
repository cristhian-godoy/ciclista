import React, { useState } from 'react';

import { type CyclingCalendarEvent, serializeCalendarFeed } from '../core/events/calendar';
import { Download, Trash2 } from './common/Icon';

/**
 * Triggers a client-side file download for calendar JSON feeds.
 */
function downloadJsonFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Studio event entity configuring localized road blockages or delays.
 */
export interface StudioEvent {
  /**
   * Unique identifier of the event.
   */
  id: string;
  /**
   * Human-readable name of the event.
   */
  name: string;
  /**
   * Optional descriptive notes or context.
   */
  description?: string;
  /**
   * Whether the event is actively applied to the road network.
   */
  active: boolean;
  /**
   * OSM edge identifiers impacted by this event.
   */
  edgeIds: string[];
  /**
   * Penalties and behaviors applied to the selected edges.
   */
  effect: {
    type: 'road_blockage';
    penaltySeconds: number;
  };
}

/**
 * Properties for EventsPanel component.
 */
export interface EventsPanelProps {
  /**
   * List of existing events configured in Studio mode.
   */
  events: StudioEvent[];
  /**
   * Current number of road edges selected on the map.
   */
  selectedEdgeCount: number;
  /**
   * Callback fired to create a new event for the selected road edges.
   */
  onCreateEvent: (name: string, description?: string) => void;
  /**
   * Callback fired to toggle the active state of an event.
   */
  onToggleEvent: (id: string) => void;
  /**
   * Callback fired to remove an event.
   */
  onDeleteEvent: (id: string) => void;
  /**
   * Callback fired to deselect all road edges on the map.
   */
  onClearSelection: () => void;
}

/**
 * Backward-compatible type alias for EventsPanelProps.
 */
export type EventManagementPanelProps = EventsPanelProps;

/**
 * Sidebar panel managing studio events, road blockages, and edge selections.
 */
export const EventsPanel: React.FC<EventsPanelProps> = ({
  events,
  selectedEdgeCount,
  onCreateEvent,
  onToggleEvent,
  onDeleteEvent,
  onClearSelection,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const isFormValid = selectedEdgeCount > 0 && name.trim().length > 0;

  const handleExportCalendar = () => {
    const calendarEvents: CyclingCalendarEvent[] = events.map((e) => {
      const now = new Date();
      const end = new Date(now.getTime() + 3 * 3600 * 1000);
      return {
        id: e.id,
        summary: e.name,
        description: e.description,
        startDate: now.toISOString(),
        endDate: end.toISOString(),
        edgeIds: e.edgeIds,
        tags: [e.effect.type],
      };
    });

    const feedJson = serializeCalendarFeed(calendarEvents, {
      title: 'Ciclista Events Export',
      description: 'Exported active and scheduled cycling network events',
    });
    downloadJsonFile(feedJson, 'ciclista-calendar-events.json');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      return;
    }
    onCreateEvent(name.trim(), description.trim() || undefined);
    setName('');
    setDescription('');
  };

  return (
    <div className="ciclista-event-panel" aria-label="Events">
      {/* Active selection status card */}
      <div className="ciclista-card ciclista-event-card ciclista-event-selection-card">
        <div className="ciclista-event-selection-status">
          <span className="ciclista-event-selection-count">
            {selectedEdgeCount} {selectedEdgeCount === 1 ? 'road segment' : 'road segments'}{' '}
            selected
          </span>
        </div>
        {selectedEdgeCount > 0 && (
          <button
            type="button"
            className="ciclista-btn ciclista-btn--secondary ciclista-event-clear-btn"
            onClick={onClearSelection}
          >
            Clear Selection
          </button>
        )}
      </div>

      {/* New Event Form */}
      <form onSubmit={handleSubmit} className="ciclista-card ciclista-event-form">
        <div className="ciclista-form-group">
          <label htmlFor="ciclista-event-name-input" className="ciclista-label">
            Event Name
          </label>
          <input
            id="ciclista-event-name-input"
            name="eventName"
            aria-label="Event Name"
            type="text"
            className="ciclista-input"
            placeholder="e.g. Marathon, Street Fair, Roadworks"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="ciclista-form-group">
          <label htmlFor="ciclista-event-description-input" className="ciclista-label">
            Description (Optional)
          </label>
          <input
            id="ciclista-event-description-input"
            name="eventDescription"
            aria-label="Description (Optional)"
            type="text"
            className="ciclista-input"
            placeholder="Additional notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="ciclista-form-group">
          <label htmlFor="ciclista-event-effect-select" className="ciclista-label">
            Effect Configuration
          </label>
          <select
            id="ciclista-event-effect-select"
            name="eventEffect"
            aria-label="Effect Configuration"
            className="ciclista-select"
            disabled={selectedEdgeCount === 0}
            defaultValue="road_blockage"
          >
            <option value="road_blockage">Road Blockage (+30s penalty)</option>
          </select>
          {selectedEdgeCount === 0 && (
            <p className="ciclista-event-hint" role="status">
              Select roads on map to attach effects
            </p>
          )}
        </div>

        <button
          type="submit"
          className="ciclista-btn ciclista-btn--primary"
          disabled={!isFormValid}
        >
          Apply Road Blockage to Selection
        </button>
      </form>

      {/* Event List */}
      <div className="ciclista-card ciclista-event-list-card">
        <div className="ciclista-event-list-header">
          <h3 className="ciclista-card-title">Configured Events</h3>
          {events.length > 0 && (
            <button
              type="button"
              className="ciclista-btn ciclista-btn--secondary ciclista-btn--sm"
              onClick={handleExportCalendar}
              aria-label="Export Calendar Feed"
              title="Export events as JSON calendar feed"
            >
              <Download size={14} /> Export Calendar
            </button>
          )}
        </div>
        {events.length === 0 ? (
          <p className="ciclista-event-empty">No events created yet.</p>
        ) : (
          <ul className="ciclista-event-list">
            {events.map((event) => (
              <li key={event.id} className="ciclista-event-item">
                <div className="ciclista-event-item-info">
                  <span className="ciclista-event-item-name">{event.name}</span>
                  <span className="ciclista-event-item-count">
                    {event.edgeIds.length} {event.edgeIds.length === 1 ? 'segment' : 'segments'}
                  </span>
                </div>
                <div className="ciclista-event-item-actions">
                  <label
                    htmlFor={`ciclista-event-active-${event.id}`}
                    className="ciclista-event-toggle-label"
                  >
                    <input
                      id={`ciclista-event-active-${event.id}`}
                      name={`eventActive-${event.id}`}
                      type="checkbox"
                      checked={event.active}
                      onChange={() => onToggleEvent(event.id)}
                      aria-label={`Toggle ${event.name}`}
                    />
                    <span>Active</span>
                  </label>
                  <button
                    type="button"
                    className="ciclista-btn ciclista-btn--danger ciclista-event-delete-btn"
                    onClick={() => onDeleteEvent(event.id)}
                    aria-label={`Delete ${event.name}`}
                    title="Delete event"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/**
 * Backward-compatible component export for EventManagementPanel.
 */
export const EventManagementPanel = EventsPanel;
