import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BikeProfile } from '../core/config';
import { DEFAULT_RULES_CONFIG } from '../core/config';
import { ProfileModal, type ProfileModalProps } from './ProfileModal';

describe('ProfileModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSelectBike = vi.fn();
  const mockOnAddBike = vi.fn();
  const mockOnUpdateBike = vi.fn();
  const mockOnDeleteBike = vi.fn();
  const mockOnRulesChange = vi.fn();

  const testBikes: BikeProfile[] = [
    {
      id: 'city',
      name: 'City Commuter',
      speedKmh: 18,
      weightKg: 14,
      surfacePreferences: {
        gravelSpeedMultiplier: 0.8,
        cobblestoneSpeedMultiplier: 0.75,
      },
      turnPenalties: {
        rightTurnPenaltySeconds: 1,
        leftTurnPenaltySeconds: 4,
        uTurnPenaltySeconds: 30,
      },
    },
    {
      id: 'road',
      name: 'Speedy Road',
      speedKmh: 28,
      weightKg: 8.5,
      surfacePreferences: {
        gravelSpeedMultiplier: 0.5,
        cobblestoneSpeedMultiplier: 0.4,
      },
      turnPenalties: {
        rightTurnPenaltySeconds: 1,
        leftTurnPenaltySeconds: 3,
        uTurnPenaltySeconds: 20,
      },
    },
  ];

  const defaultProps: ProfileModalProps = {
    isOpen: true,
    onClose: mockOnClose,
    bikes: testBikes,
    activeBikeId: 'city',
    onSelectBike: mockOnSelectBike,
    onAddBike: mockOnAddBike,
    onUpdateBike: mockOnUpdateBike,
    onDeleteBike: mockOnDeleteBike,
    rulesConfig: DEFAULT_RULES_CONFIG,
    onRulesChange: mockOnRulesChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Visibility and Dismissal', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(<ProfileModal {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders with accessibility dialog role and attributes when open', () => {
      render(<ProfileModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog', { name: 'Profile' });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('calls onClose when clicking the backdrop', () => {
      render(<ProfileModal {...defaultProps} />);
      const backdrop = screen.getByTestId('profile-modal-backdrop');
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking inside the modal container', () => {
      render(<ProfileModal {...defaultProps} />);
      const modal = screen.getByTestId('profile-modal');
      fireEvent.click(modal);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('calls onClose when clicking the header close button', () => {
      render(<ProfileModal {...defaultProps} />);
      const closeBtn = screen.getByTestId('profile-close-btn');
      fireEvent.click(closeBtn);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the Done footer button', () => {
      render(<ProfileModal {...defaultProps} />);
      const doneBtn = screen.getByTestId('profile-done-btn');
      fireEvent.click(doneBtn);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when pressing the Escape key', () => {
      render(<ProfileModal {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sidebar Navigation', () => {
    it('renders navigation tabs for equipment and road rules', () => {
      render(<ProfileModal {...defaultProps} />);
      expect(screen.getByTestId('profile-nav-bikes')).toBeInTheDocument();
      expect(screen.getByTestId('profile-nav-signs')).toBeInTheDocument();
      expect(screen.getByTestId('profile-nav-roads')).toBeInTheDocument();
      expect(screen.getByTestId('profile-nav-intersections')).toBeInTheDocument();
      expect(screen.getByTestId('profile-nav-turns')).toBeInTheDocument();
    });

    it('defaults to bikes section when initialSection is omitted', () => {
      render(<ProfileModal {...defaultProps} />);
      expect(screen.getByTestId('profile-nav-bikes')).toHaveClass('active');
      expect(screen.getByTestId('profile-add-bike-btn')).toBeInTheDocument();
    });

    it('respects initialSection prop when passed', () => {
      render(<ProfileModal {...defaultProps} initialSection="signs" />);
      expect(screen.getByTestId('profile-nav-signs')).toHaveClass('active');
      expect(screen.getByTestId('profile-signs-list')).toBeInTheDocument();
    });

    it('switches navigation sections when sidebar tabs are clicked', () => {
      render(<ProfileModal {...defaultProps} />);

      // Switch to Traffic Signs
      fireEvent.click(screen.getByTestId('profile-nav-signs'));
      expect(screen.getByTestId('profile-signs-list')).toBeInTheDocument();

      // Switch to Road Classes
      fireEvent.click(screen.getByTestId('profile-nav-roads'));
      expect(screen.getByTestId('profile-roads-list')).toBeInTheDocument();

      // Switch to Intersections
      fireEvent.click(screen.getByTestId('profile-nav-intersections'));
      expect(screen.getByTestId('profile-intersections-section')).toBeInTheDocument();

      // Switch to Turn Penalties
      fireEvent.click(screen.getByTestId('profile-nav-turns'));
      expect(screen.getByTestId('profile-turns-section')).toBeInTheDocument();

      // Switch back to Bikes
      fireEvent.click(screen.getByTestId('profile-nav-bikes'));
      expect(screen.getByTestId('profile-add-bike-btn')).toBeInTheDocument();
    });
  });

  describe('Bikes CRUD Management', () => {
    it('renders the list of configured bikes with names and speeds', () => {
      render(<ProfileModal {...defaultProps} />);
      expect(screen.getByText('City Commuter')).toBeInTheDocument();
      expect(screen.getByText('18 km/h')).toBeInTheDocument();
      expect(screen.getByText('Speedy Road')).toBeInTheDocument();
      expect(screen.getByText('28 km/h')).toBeInTheDocument();
    });

    it('displays active badge for current activeBikeId and use button for inactive bikes', () => {
      render(<ProfileModal {...defaultProps} activeBikeId="city" />);
      expect(screen.getByTestId('profile-bike-active-city')).toBeInTheDocument();
      expect(screen.getByTestId('profile-activate-bike-road')).toBeInTheDocument();
    });

    it('calls onSelectBike when clicking the Use button on an inactive bike', () => {
      render(<ProfileModal {...defaultProps} activeBikeId="city" />);
      const useBtn = screen.getByTestId('profile-activate-bike-road');
      fireEvent.click(useBtn);
      expect(mockOnSelectBike).toHaveBeenCalledWith('road');
    });

    it('switches bike editor form when clicking another bike tab', () => {
      render(<ProfileModal {...defaultProps} />);
      const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
      expect(nameInput.value).toBe('City Commuter');

      // Click second bike tab
      fireEvent.click(screen.getByTestId('profile-bike-item-road'));
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Speedy Road');
    });

    it('calls onAddBike with default specifications when clicking + Add Bike', () => {
      render(<ProfileModal {...defaultProps} />);
      const addBtn = screen.getByTestId('profile-add-bike-btn');
      fireEvent.click(addBtn);

      expect(mockOnAddBike).toHaveBeenCalledTimes(1);
      expect(mockOnAddBike).toHaveBeenCalledWith({
        name: 'New Bike',
        speedKmh: 20,
        surfacePreferences: {
          gravelSpeedMultiplier: 0.8,
          cobblestoneSpeedMultiplier: 0.75,
        },
        turnPenalties: {
          rightTurnPenaltySeconds: 1,
          leftTurnPenaltySeconds: 4,
          uTurnPenaltySeconds: 30,
        },
      });
    });

    it('updates bike name when editing name field', () => {
      render(<ProfileModal {...defaultProps} />);
      const nameInput = screen.getByLabelText('Name');
      fireEvent.change(nameInput, { target: { value: 'Work Bike' } });

      expect(mockOnUpdateBike).toHaveBeenCalledWith('city', { name: 'Work Bike' });
    });

    it('updates bike speed when editing speed field', () => {
      render(<ProfileModal {...defaultProps} />);
      const speedInput = screen.getByLabelText('Speed (km/h)');
      fireEvent.change(speedInput, { target: { value: '22' } });

      expect(mockOnUpdateBike).toHaveBeenCalledWith('city', { speedKmh: 22 });
    });

    it('updates bike weight and handles clearing to undefined', () => {
      render(<ProfileModal {...defaultProps} />);
      const weightInput = screen.getByLabelText('Weight (kg, optional)');
      expect((weightInput as HTMLInputElement).value).toBe('14');

      // Update weight
      fireEvent.change(weightInput, { target: { value: '16.5' } });
      expect(mockOnUpdateBike).toHaveBeenCalledWith('city', { weightKg: 16.5 });

      // Clear weight to empty string
      fireEvent.change(weightInput, { target: { value: '' } });
      expect(mockOnUpdateBike).toHaveBeenCalledWith('city', { weightKg: undefined });
    });

    it('updates surface preferences (gravel and cobblestone multipliers)', () => {
      render(<ProfileModal {...defaultProps} />);
      const gravelInput = screen.getByLabelText('Gravel Multiplier');
      fireEvent.change(gravelInput, { target: { value: '0.85' } });

      expect(mockOnUpdateBike).toHaveBeenCalledWith('city', {
        surfacePreferences: {
          gravelSpeedMultiplier: 0.85,
          cobblestoneSpeedMultiplier: 0.75,
        },
      });

      const cobblestoneInput = screen.getByLabelText('Cobblestone Multiplier');
      fireEvent.change(cobblestoneInput, { target: { value: '0.7' } });

      expect(mockOnUpdateBike).toHaveBeenCalledWith('city', {
        surfacePreferences: {
          gravelSpeedMultiplier: 0.8,
          cobblestoneSpeedMultiplier: 0.7,
        },
      });
    });

    it('updates turn penalties (right and left turn penalties)', () => {
      render(<ProfileModal {...defaultProps} />);
      const rightTurnInput = screen.getByLabelText('Right Turn Penalty (s)');
      fireEvent.change(rightTurnInput, { target: { value: '2' } });

      expect(mockOnUpdateBike).toHaveBeenCalledWith('city', {
        turnPenalties: {
          rightTurnPenaltySeconds: 2,
          leftTurnPenaltySeconds: 4,
          uTurnPenaltySeconds: 30,
        },
      });

      const leftTurnInput = screen.getByLabelText('Left Turn Penalty (s)');
      fireEvent.change(leftTurnInput, { target: { value: '6' } });

      expect(mockOnUpdateBike).toHaveBeenCalledWith('city', {
        turnPenalties: {
          rightTurnPenaltySeconds: 1,
          leftTurnPenaltySeconds: 6,
          uTurnPenaltySeconds: 30,
        },
      });
    });

    it('disables Delete Bike button when only 1 bike exists', () => {
      render(<ProfileModal {...defaultProps} bikes={[testBikes[0]]} />);
      const deleteBtn = screen.getByTestId('profile-delete-bike-btn');
      expect(deleteBtn).toBeDisabled();
    });

    it('enables Delete Bike button when multiple bikes exist and calls onDeleteBike', () => {
      render(<ProfileModal {...defaultProps} bikes={testBikes} />);
      const deleteBtn = screen.getByTestId('profile-delete-bike-btn');
      expect(deleteBtn).not.toBeDisabled();

      fireEvent.click(deleteBtn);
      expect(mockOnDeleteBike).toHaveBeenCalledWith('city');
    });

    it('renders empty message when bikes list is empty', () => {
      render(<ProfileModal {...defaultProps} bikes={[]} />);
      expect(screen.getByText('No bikes configured.')).toBeInTheDocument();
    });
  });

  describe('Road Rules Configuration', () => {
    it('renders traffic signs and updates rules configuration when changing a sign', () => {
      render(<ProfileModal {...defaultProps} initialSection="signs" />);
      expect(screen.getByTestId('profile-signs-list')).toBeInTheDocument();

      // Verify sign names are present
      expect(screen.getByText('Pedestrian Zone')).toBeInTheDocument();
      expect(screen.getByText('Living Street')).toBeInTheDocument();
    });

    it('renders road classes and updates rules configuration', () => {
      render(<ProfileModal {...defaultProps} initialSection="roads" />);
      expect(screen.getByTestId('profile-roads-list')).toBeInTheDocument();

      expect(screen.getByText('Primary Road')).toBeInTheDocument();
      expect(screen.getByText('Secondary Road')).toBeInTheDocument();
    });

    it('renders intersection delays section and turn penalties section', () => {
      const { rerender } = render(
        <ProfileModal {...defaultProps} initialSection="intersections" />,
      );
      expect(screen.getByTestId('profile-intersections-section')).toBeInTheDocument();

      rerender(<ProfileModal {...defaultProps} initialSection="turns" />);
      expect(screen.getByTestId('profile-turns-section')).toBeInTheDocument();
    });

    it('calls onRulesChange with DEFAULT_RULES_CONFIG when clicking Reset Rules to Defaults', () => {
      render(<ProfileModal {...defaultProps} initialSection="signs" />);
      const resetBtn = screen.getByTestId('profile-reset-rules-btn');
      fireEvent.click(resetBtn);

      expect(mockOnRulesChange).toHaveBeenCalledWith(DEFAULT_RULES_CONFIG);
    });
  });
});
