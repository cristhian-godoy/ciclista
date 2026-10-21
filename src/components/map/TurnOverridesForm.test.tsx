import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type NodeManeuver, TurnOverridesForm } from './TurnOverridesForm';

describe('TurnOverridesForm', () => {
  const sampleManeuvers: NodeManeuver[] = [
    {
      fromNodeId: 'node-1',
      fromStreetName: 'Main Street',
      toNodeId: 'node-2',
      toStreetName: 'Oak Avenue',
      direction: 'left',
      incomingDir: 'Northbound',
      outgoingDir: 'Westbound',
    },
  ];

  it('renders nothing when maneuvers list is empty', () => {
    const { container } = render(
      <TurnOverridesForm maneuvers={[]} nodeTurns={{}} onTurnChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders turn items and triggers onTurnChange when selecting an option', () => {
    const handleTurnChange = vi.fn();
    render(
      <TurnOverridesForm
        maneuvers={sampleManeuvers}
        nodeTurns={{}}
        onTurnChange={handleTurnChange}
      />,
    );

    expect(screen.getByText('Turn Overrides')).toBeInTheDocument();
    expect(screen.getByText('Main Street')).toBeInTheDocument();
    expect(screen.getByText('Oak Avenue')).toBeInTheDocument();

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'left_turn' } });

    expect(handleTurnChange).toHaveBeenCalledWith('node-1->node-2', 'left_turn');
  });
});
