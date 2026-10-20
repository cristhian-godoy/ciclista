import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { CreatePlaceInput, Place, UpdatePlaceInput } from '../../hooks/usePlaces';
import { PlaceForm } from './PlaceForm';

describe('PlaceForm', () => {
  let onCloseMock: Mock<() => void>;
  let onCreatePlaceMock: Mock<(input: CreatePlaceInput) => void>;
  let onUpdatePlaceMock: Mock<(id: string, updates: UpdatePlaceInput) => void>;

  const samplePlace: Place = {
    id: 'place-test-1',
    name: 'Coffee Roastery',
    category: 'other',
    lat: 48.138,
    lng: 11.576,
    description: 'Outdoor bike parking',
    createdAt: 1000,
    updatedAt: 1000,
  };

  beforeEach(() => {
    onCloseMock = vi.fn();
    onCreatePlaceMock = vi.fn();
    onUpdatePlaceMock = vi.fn();
  });

  it('renders form with category selector, name, notes, and action buttons', () => {
    render(
      <PlaceForm
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
      />,
    );

    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes / Description (Optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Place' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows error if submitted without a category', async () => {
    const user = userEvent.setup();
    render(
      <PlaceForm
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add Place' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a category.');
    expect(onCreatePlaceMock).not.toHaveBeenCalled();
  });

  it('submits updated data when editing existing place', async () => {
    const user = userEvent.setup();
    render(
      <PlaceForm
        place={samplePlace}
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
      />,
    );

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Coffee Roastery');

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Specialty Coffee');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onUpdatePlaceMock).toHaveBeenCalledWith('place-test-1', {
      name: 'Specialty Coffee',
      category: 'other',
      lat: 48.138,
      lng: 11.576,
      description: 'Outdoor bike parking',
    });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
