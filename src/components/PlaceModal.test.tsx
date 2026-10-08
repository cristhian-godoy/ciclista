import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { CreatePlaceInput, Place, UpdatePlaceInput } from '../hooks/usePlaces';
import { PlaceModal } from './PlaceModal';

describe('PlaceModal Component', () => {
  let onCloseMock: Mock<() => void>;
  let onCreatePlaceMock: Mock<(input: CreatePlaceInput) => void>;
  let onUpdatePlaceMock: Mock<(id: string, updates: UpdatePlaceInput) => void>;

  const samplePlace: Place = {
    id: 'place-test-1',
    name: 'Bike Hub',
    category: 'other',
    lat: 48.138,
    lng: 11.576,
    description: 'Repair rack available',
    createdAt: 1000,
    updatedAt: 1000,
  };

  beforeEach(() => {
    onCloseMock = vi.fn();
    onCreatePlaceMock = vi.fn();
    onUpdatePlaceMock = vi.fn();
  });

  it('renders creation form without manual lat/lng fields or map center button', () => {
    render(
      <PlaceModal
        isOpen={true}
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
        initialCoordinates={{ lat: 48.14, lng: 11.58 }}
      />,
    );

    expect(screen.getByText('Add New Place')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes / Description (Optional)')).toBeInTheDocument();

    // Verify lat/lng inputs and Map Center button are purged
    expect(screen.queryByLabelText(/latitude/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/longitude/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /map center/i })).not.toBeInTheDocument();
  });

  it('defaults category dropdown to unselected placeholder "Select category..." and leaves name empty', () => {
    render(
      <PlaceModal
        isOpen={true}
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
      />,
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Select category...');

    const nameInput = screen.getByLabelText('Name');
    expect(nameInput).toHaveValue('');
  });

  it('prevents submission and displays error when no category is selected', async () => {
    const user = userEvent.setup();
    render(
      <PlaceModal
        isOpen={true}
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add Place' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Please select a category.');
    expect(onCreatePlaceMock).not.toHaveBeenCalled();
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('verifies form field order: Category comes first, then Name, then Notes', () => {
    render(
      <PlaceModal
        isOpen={true}
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
      />,
    );

    const form = screen.getByRole('button', { name: 'Add Place' }).closest('form');
    expect(form).not.toBeNull();

    const labels = form!.querySelectorAll('label');
    expect(labels[0]?.textContent).toContain('Category');
    expect(labels[1]?.textContent).toContain('Name');
    expect(labels[2]?.textContent).toContain('Notes / Description (Optional)');
  });

  it('opens searchable dropdown with strictly 5 categories and filters with search input', async () => {
    const user = userEvent.setup();
    render(
      <PlaceModal
        isOpen={true}
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
      />,
    );

    // Click trigger to open dropdown
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    // Check strictly: Home, Work, Doctor, School, Other options exist
    expect(screen.getByRole('option', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /work/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /doctor/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /school/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /other/i })).toBeInTheDocument();

    // Filter categories via search input
    const searchInput = screen.getByPlaceholderText('Search category...');
    await user.type(searchInput, 'doc');

    expect(screen.getByRole('option', { name: /doctor/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /home/i })).not.toBeInTheDocument();
  });

  it('automatically prefills the name input when a category is selected and allows editing', async () => {
    const user = userEvent.setup();
    render(
      <PlaceModal
        isOpen={true}
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
        initialCoordinates={{ lat: 48.13, lng: 11.57 }}
      />,
    );

    // Open dropdown and select "Work"
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    const workOption = screen.getByRole('option', { name: /work/i });
    await user.click(workOption);

    // Name should be auto-prefilled with "Work"
    const nameInput = screen.getByLabelText('Name');
    expect(nameInput).toHaveValue('Work');

    // User can edit the name afterwards
    await user.type(nameInput, ' Central Office');
    expect(nameInput).toHaveValue('Work Central Office');

    // Submit form
    await user.click(screen.getByRole('button', { name: 'Add Place' }));

    expect(onCreatePlaceMock).toHaveBeenCalledWith({
      name: 'Work Central Office',
      category: 'work',
      lat: 48.13,
      lng: 11.57,
      description: undefined,
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('prefills editing fields when place is provided and calls onUpdatePlace on save', async () => {
    const user = userEvent.setup();
    render(
      <PlaceModal
        isOpen={true}
        place={samplePlace}
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
      />,
    );

    expect(screen.getByText('Edit Place')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Bike Hub');
    expect(screen.getByLabelText('Notes / Description (Optional)')).toHaveValue(
      'Repair rack available',
    );

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Super Bike Hub');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onUpdatePlaceMock).toHaveBeenCalledWith('place-test-1', {
      name: 'Super Bike Hub',
      category: 'other',
      lat: 48.138,
      lng: 11.576,
      description: 'Repair rack available',
    });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('supports keyboard navigation in category searchable dropdown', async () => {
    const user = userEvent.setup();
    render(
      <PlaceModal
        isOpen={true}
        onClose={onCloseMock}
        onCreatePlace={onCreatePlaceMock}
        onUpdatePlace={onUpdatePlaceMock}
      />,
    );

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText('Search category...');
    expect(searchInput).toBeInTheDocument();

    await user.keyboard('{ArrowDown}{Enter}');
    // Second option is "Work"
    expect(screen.getByLabelText('Name')).toHaveValue('Work');
  });
});
