import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { CreateLandmarkInput, Landmark, UpdateLandmarkInput } from '../core/landmarks/types';
import { LandmarkModal } from './LandmarkModal';

describe('LandmarkModal Component', () => {
  let onCloseMock: Mock<() => void>;
  let onCreateLandmarkMock: Mock<(input: CreateLandmarkInput) => void>;
  let onUpdateLandmarkMock: Mock<(id: string, updates: UpdateLandmarkInput) => void>;

  const sampleLandmark: Landmark = {
    id: 'lm-test-1',
    name: 'Bike Hub',
    category: 'transit',
    lat: 48.138,
    lng: 11.576,
    description: 'Repair rack available',
    createdAt: 1000,
    updatedAt: 1000,
  };

  beforeEach(() => {
    onCloseMock = vi.fn();
    onCreateLandmarkMock = vi.fn();
    onUpdateLandmarkMock = vi.fn();
  });

  it('renders creation form when no landmark is provided', () => {
    render(
      <LandmarkModal
        isOpen={true}
        onClose={onCloseMock}
        onCreateLandmark={onCreateLandmarkMock}
        onUpdateLandmark={onUpdateLandmarkMock}
        initialCoordinates={{ lat: 48.14, lng: 11.58 }}
      />,
    );

    expect(screen.getByText('Add New Favorite Place')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Latitude')).toHaveValue(48.14);
    expect(screen.getByLabelText('Longitude')).toHaveValue(11.58);
  });

  it('prefills editing fields when landmark is provided', () => {
    render(
      <LandmarkModal
        isOpen={true}
        landmark={sampleLandmark}
        onClose={onCloseMock}
        onCreateLandmark={onCreateLandmarkMock}
        onUpdateLandmark={onUpdateLandmarkMock}
      />,
    );

    expect(screen.getByText('Edit Favorite Place')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Bike Hub');
    expect(screen.getByLabelText('Category')).toHaveValue('transit');
    expect(screen.getByLabelText('Latitude')).toHaveValue(48.138);
    expect(screen.getByLabelText('Longitude')).toHaveValue(11.576);
    expect(screen.getByLabelText('Notes / Description (Optional)')).toHaveValue(
      'Repair rack available',
    );
  });

  it('calls onUpdateLandmark and onClose on valid edit submission', async () => {
    const user = userEvent.setup();
    render(
      <LandmarkModal
        isOpen={true}
        landmark={sampleLandmark}
        onClose={onCloseMock}
        onCreateLandmark={onCreateLandmarkMock}
        onUpdateLandmark={onUpdateLandmarkMock}
      />,
    );

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Super Bike Hub');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onUpdateLandmarkMock).toHaveBeenCalledWith('lm-test-1', {
      name: 'Super Bike Hub',
      category: 'transit',
      lat: 48.138,
      lng: 11.576,
      description: 'Repair rack available',
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('calls onCreateLandmark and onClose on valid creation submission', async () => {
    const user = userEvent.setup();
    render(
      <LandmarkModal
        isOpen={true}
        onClose={onCloseMock}
        onCreateLandmark={onCreateLandmarkMock}
        onUpdateLandmark={onUpdateLandmarkMock}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Bakery');
    await user.type(screen.getByLabelText('Latitude'), '48.13');
    await user.type(screen.getByLabelText('Longitude'), '11.57');
    await user.click(screen.getByRole('button', { name: 'Add Favorite Place' }));

    expect(onCreateLandmarkMock).toHaveBeenCalledWith({
      name: 'Bakery',
      category: 'home',
      lat: 48.13,
      lng: 11.57,
      description: undefined,
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('prefills coordinates from point buttons', async () => {
    const user = userEvent.setup();
    render(
      <LandmarkModal
        isOpen={true}
        onClose={onCloseMock}
        onCreateLandmark={onCreateLandmarkMock}
        onUpdateLandmark={onUpdateLandmarkMock}
        currentMapCenter={{ lat: 48.139, lng: 11.579 }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Map Center/i }));
    expect(screen.getByLabelText('Latitude')).toHaveValue(48.139);
    expect(screen.getByLabelText('Longitude')).toHaveValue(11.579);
  });
});
