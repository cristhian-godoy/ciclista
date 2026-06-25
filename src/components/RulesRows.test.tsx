import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { RoadRuleConfig, SignRuleConfig } from '../core/config';
import { InfrastructureType } from '../core/config';
import { RoadRow, SignRow } from './RulesRows';

describe('RulesRows Components', () => {
  const mockSignConfig: SignRuleConfig = {
    signId: InfrastructureType.SHARED_PATH,
    name: 'Shared Pedestrian/Cycle Path',
    description: 'Bikes and pedestrians share the lane.',
    iconCode: '🔵',
    baseSpeedKmh: 15,
    speedType: 'custom',
    comfort: 'neutral',
    flatPenaltySeconds: 10,
  };

  const mockRoadConfig: RoadRuleConfig = {
    roadId: 'residential',
    name: 'Residential Street',
    baseSpeedKmh: 20,
    speedType: 'custom',
    comfort: 'high',
    flatPenaltySeconds: 5,
  };

  describe('SignRow', () => {
    it('renders with header collapsed initially', () => {
      render(<SignRow config={mockSignConfig} onChange={vi.fn()} />);

      expect(screen.getByText('Shared Pedestrian/Cycle Path')).toBeInTheDocument();
      expect(screen.getByText('🔵')).toBeInTheDocument();
      expect(screen.queryByText('Bikes and pedestrians share the lane.')).not.toBeInTheDocument();
    });

    it('expands body and reveals fields upon clicking the header', async () => {
      const user = userEvent.setup();
      render(<SignRow config={mockSignConfig} onChange={vi.fn()} />);

      const button = screen.getByRole('button', { name: /Shared Pedestrian\/Cycle Path/i });
      await user.click(button);

      expect(screen.getByText('Bikes and pedestrians share the lane.')).toBeInTheDocument();
      expect(screen.getByText(/Base speed:/i)).toBeInTheDocument();
      expect(screen.getByText(/Comfort level/i)).toBeInTheDocument();
    });

    it('calls onChange when altering Avoidance time penalty slider', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<SignRow config={mockSignConfig} onChange={handleChange} />);

      const button = screen.getByRole('button', { name: /Shared Pedestrian\/Cycle Path/i });
      await user.click(button);

      const sliders = screen.getAllByRole('slider');
      const penaltySlider = sliders[1]; // The second slider is the avoidance penalty
      fireEvent.change(penaltySlider, { target: { value: '25' } });

      expect(handleChange).toHaveBeenCalled();
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          flatPenaltySeconds: 25,
        }),
      );
    });
  });

  describe('RoadRow', () => {
    it('expands body and reveals fields upon clicking header', async () => {
      const user = userEvent.setup();
      render(<RoadRow config={mockRoadConfig} onChange={vi.fn()} />);

      const button = screen.getByRole('button', { name: /Residential Street/i });
      await user.click(button);

      expect(screen.getByText(/Comfort level/i)).toBeInTheDocument();
      expect(screen.getByText(/Avoidance time penalty:/i)).toBeInTheDocument();
    });

    it('calls onChange when comfort selector is changed', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<RoadRow config={mockRoadConfig} onChange={handleChange} />);

      const button = screen.getByRole('button', { name: /Residential Street/i });
      await user.click(button);

      // Select comfort buttons - use exact string 'Low' to avoid matching 'Slow' or 'Very Low'
      const lowComfortButton = screen.getByRole('button', { name: 'Low' });
      await user.click(lowComfortButton);

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          comfort: 'low',
        }),
      );
    });
  });
});
