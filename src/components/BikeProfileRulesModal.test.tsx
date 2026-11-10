import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_RULES_CONFIG } from '../core/config';
import { BikeProfileRulesModal } from './BikeProfileRulesModal';

describe('BikeProfileRulesModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    bikeConfig: { id: 'normal' as const },
    onBikeConfigChange: vi.fn(),
    rulesConfig: DEFAULT_RULES_CONFIG,
    onRulesChange: vi.fn(),
  };

  it('renders modal header, tab controls, and bike profile preset options', () => {
    render(<BikeProfileRulesModal {...defaultProps} />);

    expect(screen.getByRole('dialog', { name: /Bike Setup and Road Rules/i })).toBeInTheDocument();
    expect(screen.getByText('Bike Setup & Road Rules')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bike Profile$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Road Rules$/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Standard$/i })).toHaveClass('active');
    expect(screen.getByRole('button', { name: /Road$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /E-Bike$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cargo$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Custom$/i })).toBeInTheDocument();

    expect(screen.getByLabelText('Speed (km/h)')).toHaveValue(18);
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(75);
    expect(screen.getByLabelText('Right Turn')).toHaveValue(1);
    expect(screen.getByLabelText('Left Turn')).toHaveValue(4);
    expect(screen.getByLabelText('Gravel')).toHaveValue(0.8);
    expect(screen.getByLabelText('Cobblestone')).toHaveValue(0.75);
  });

  it('triggers onBikeConfigChange when switching profile preset', async () => {
    const user = userEvent.setup();
    const handleBikeChange = vi.fn();

    render(<BikeProfileRulesModal {...defaultProps} onBikeConfigChange={handleBikeChange} />);

    const roadBtn = screen.getByRole('button', { name: /Road$/i });
    await user.click(roadBtn);
    expect(handleBikeChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'road' }));
  });

  it('allows tuning speed, weight, turn penalties, and surface multipliers', async () => {
    const user = userEvent.setup();
    const handleBikeChange = vi.fn();

    render(
      <BikeProfileRulesModal
        {...defaultProps}
        bikeConfig={{
          id: 'custom',
          customSpeedKmh: 22,
          weightKg: 85,
          turnPenalties: { rightTurnPenaltySeconds: 2, leftTurnPenaltySeconds: 5 },
          surfacePreferences: { gravelSpeedMultiplier: 0.6, cobblestoneSpeedMultiplier: 0.7 },
        }}
        onBikeConfigChange={handleBikeChange}
      />,
    );

    const speedInput = screen.getByLabelText('Speed (km/h)');
    expect(speedInput).toHaveValue(22);
    await user.clear(speedInput);
    await user.type(speedInput, '28');
    expect(handleBikeChange).toHaveBeenCalled();

    const weightInput = screen.getByLabelText('Weight (kg)');
    expect(weightInput).toHaveValue(85);
    await user.clear(weightInput);
    await user.type(weightInput, '90');
    expect(handleBikeChange).toHaveBeenCalled();

    const rightTurnInput = screen.getByLabelText('Right Turn');
    await user.clear(rightTurnInput);
    await user.type(rightTurnInput, '3');
    expect(handleBikeChange).toHaveBeenCalled();

    const gravelInput = screen.getByLabelText('Gravel');
    await user.clear(gravelInput);
    await user.type(gravelInput, '0.5');
    expect(handleBikeChange).toHaveBeenCalled();
  });

  it('resets custom bike tuning parameters when clicking Reset Profile Parameters', async () => {
    const user = userEvent.setup();
    const handleBikeChange = vi.fn();

    render(
      <BikeProfileRulesModal
        {...defaultProps}
        bikeConfig={{
          id: 'custom',
          customSpeedKmh: 28,
          weightKg: 90,
          turnPenalties: { rightTurnPenaltySeconds: 3, leftTurnPenaltySeconds: 6 },
          surfacePreferences: { gravelSpeedMultiplier: 0.5, cobblestoneSpeedMultiplier: 0.6 },
        }}
        onBikeConfigChange={handleBikeChange}
      />,
    );

    const resetBtn = screen.getByRole('button', { name: /Reset Profile Parameters/i });
    await user.click(resetBtn);

    expect(handleBikeChange).toHaveBeenCalledWith({
      id: 'custom',
      customSpeedKmh: undefined,
      weightKg: undefined,
      turnPenalties: undefined,
      surfacePreferences: undefined,
    });
  });

  it('switches between Bike Profile and Road Rules tabs', async () => {
    const user = userEvent.setup();
    render(<BikeProfileRulesModal {...defaultProps} />);

    expect(screen.getByText('Preset Profile')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Traffic Signs/i })).not.toBeInTheDocument();

    const rulesTabBtn = screen.getByRole('button', { name: /Road Rules$/i });
    await user.click(rulesTabBtn);

    expect(screen.getByRole('heading', { name: 'Road Rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Traffic Signs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Road Classes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Intersections/i })).toBeInTheDocument();
    expect(screen.queryByText('Preset Profile')).not.toBeInTheDocument();
  });

  it('opens directly in Road Rules tab when initialTab is rules', () => {
    render(<BikeProfileRulesModal {...defaultProps} initialTab="rules" />);

    expect(screen.getByRole('heading', { name: 'Road Rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Traffic Signs/i })).toBeInTheDocument();
    expect(screen.queryByText('Preset Profile')).not.toBeInTheDocument();
  });

  it('calls onClose when Done button or Escape key is pressed', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(<BikeProfileRulesModal {...defaultProps} onClose={handleClose} />);

    const doneBtn = screen.getByTestId('bike-rules-modal-done-btn');
    await user.click(doneBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
