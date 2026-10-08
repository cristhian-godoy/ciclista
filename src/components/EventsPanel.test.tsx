import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EventsPanel, type EventsPanelProps, type StudioEvent } from './EventsPanel';

describe('EventsPanel Component', () => {
  const mockEvents: StudioEvent[] = [
    {
      id: 'event-1',
      name: 'City Marathon',
      description: 'Major running event downtown',
      active: true,
      edgeIds: ['edge-101', 'edge-102'],
      effect: {
        type: 'road_blockage',
        penaltySeconds: 30,
      },
    },
    {
      id: 'event-2',
      name: 'Water Main Repair',
      active: false,
      edgeIds: ['edge-201'],
      effect: {
        type: 'road_blockage',
        penaltySeconds: 30,
      },
    },
  ];

  const defaultProps: EventsPanelProps = {
    events: mockEvents,
    selectedEdgeCount: 0,
    onCreateEvent: vi.fn(),
    onToggleEvent: vi.fn(),
    onDeleteEvent: vi.fn(),
    onClearSelection: vi.fn(),
  };

  it('renders selection card and configured events list with Events aria label', () => {
    render(<EventsPanel {...defaultProps} />);

    expect(screen.getByLabelText('Events')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configured Events' })).toBeInTheDocument();
    expect(screen.getByText(/0 road segments selected/i)).toBeInTheDocument();
    expect(screen.getByText('City Marathon')).toBeInTheDocument();
    expect(screen.getByText('2 segments')).toBeInTheDocument();
    expect(screen.getByText('Water Main Repair')).toBeInTheDocument();
    expect(screen.getByText('1 segment')).toBeInTheDocument();
  });

  it('handles empty events list gracefully', () => {
    render(<EventsPanel {...defaultProps} events={[]} />);

    expect(screen.getByText('No events created yet.')).toBeInTheDocument();
  });

  describe('Edge Selection Status & Clear Selection', () => {
    it('does not display clear button when selectedEdgeCount is 0', () => {
      render(<EventsPanel {...defaultProps} selectedEdgeCount={0} />);

      expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
    });

    it('displays clear button and pluralization correctly when selectedEdgeCount is 1', async () => {
      const user = userEvent.setup();
      const onClearSelection = vi.fn();

      render(
        <EventsPanel {...defaultProps} selectedEdgeCount={1} onClearSelection={onClearSelection} />,
      );

      expect(screen.getByText(/1 road segment selected/i)).toBeInTheDocument();
      const clearBtn = screen.getByRole('button', { name: 'Clear Selection' });
      expect(clearBtn).toBeInTheDocument();

      await user.click(clearBtn);
      expect(onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('displays clear button and pluralization when selectedEdgeCount > 1', () => {
      render(<EventsPanel {...defaultProps} selectedEdgeCount={3} />);

      expect(screen.getByText(/3 road segments selected/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeInTheDocument();
    });
  });

  describe('Effect Gating and Event Creation', () => {
    it('disables effect configuration and displays explanatory hint when selectedEdgeCount is 0', () => {
      render(<EventsPanel {...defaultProps} selectedEdgeCount={0} />);

      const effectSelect = screen.getByLabelText(/Effect Configuration/i);
      expect(effectSelect).toBeDisabled();

      expect(screen.getByText('Select roads on map to attach effects')).toBeInTheDocument();

      const submitButton = screen.getByRole('button', {
        name: 'Apply Road Blockage to Selection',
      });
      expect(submitButton).toBeDisabled();
    });

    it('enables effect configuration and hides hint when selectedEdgeCount > 0', () => {
      render(<EventsPanel {...defaultProps} selectedEdgeCount={2} />);

      const effectSelect = screen.getByLabelText(/Effect Configuration/i);
      expect(effectSelect).not.toBeDisabled();

      expect(screen.queryByText('Select roads on map to attach effects')).not.toBeInTheDocument();
    });

    it('keeps apply button disabled when name is empty even if edges are selected', async () => {
      render(<EventsPanel {...defaultProps} selectedEdgeCount={2} />);

      const submitButton = screen.getByRole('button', {
        name: 'Apply Road Blockage to Selection',
      });
      expect(submitButton).toBeDisabled();
    });

    it('creates an event and resets input fields when form is submitted with valid inputs', async () => {
      const user = userEvent.setup();
      const onCreateEvent = vi.fn();

      render(<EventsPanel {...defaultProps} selectedEdgeCount={3} onCreateEvent={onCreateEvent} />);

      const nameInput = screen.getByLabelText(/Event Name/i);
      const descInput = screen.getByLabelText(/Description \(Optional\)/i);
      const submitButton = screen.getByRole('button', {
        name: 'Apply Road Blockage to Selection',
      });

      await user.type(nameInput, 'Street Festival');
      await user.type(descInput, 'Weekend closure');

      expect(submitButton).not.toBeDisabled();

      await user.click(submitButton);

      expect(onCreateEvent).toHaveBeenCalledTimes(1);
      expect(onCreateEvent).toHaveBeenCalledWith('Street Festival', 'Weekend closure');

      expect(nameInput).toHaveValue('');
      expect(descInput).toHaveValue('');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Event Actions (Toggle and Delete)', () => {
    it('calls onToggleEvent when active checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onToggleEvent = vi.fn();

      render(<EventsPanel {...defaultProps} onToggleEvent={onToggleEvent} />);

      const checkbox = screen.getByRole('checkbox', { name: 'Toggle City Marathon' });
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(onToggleEvent).toHaveBeenCalledTimes(1);
      expect(onToggleEvent).toHaveBeenCalledWith('event-1');
    });

    it('calls onDeleteEvent when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onDeleteEvent = vi.fn();

      render(<EventsPanel {...defaultProps} onDeleteEvent={onDeleteEvent} />);

      const deleteBtn = screen.getByRole('button', { name: 'Delete Water Main Repair' });
      await user.click(deleteBtn);

      expect(onDeleteEvent).toHaveBeenCalledTimes(1);
      expect(onDeleteEvent).toHaveBeenCalledWith('event-2');
    });
  });
});
