import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Coordinate } from '../core/common/types';
import type { CreatePlaceInput, Place, UpdatePlaceInput } from '../hooks/usePlaces';
import { PlaceModal } from './PlaceModal';
import { PlacesPanel } from './PlacesPanel';

describe('PlacesPanel Component', () => {
  const samplePlaces: Place[] = [
    {
      id: 'place-1',
      name: 'Apartment',
      category: 'home',
      lat: 48.137,
      lng: 11.575,
      description: 'First floor with bike rack',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'place-2',
      name: 'Tech Park Office',
      category: 'work',
      lat: 48.145,
      lng: 11.585,
      createdAt: 2000,
      updatedAt: 2000,
    },
    {
      id: 'place-3',
      name: 'Dr. Mueller Clinic',
      category: 'doctor',
      lat: 48.12,
      lng: 11.56,
      createdAt: 3000,
      updatedAt: 3000,
    },
  ];

  let onCreatePlace: Mock<(input: CreatePlaceInput) => void>;
  let onUpdatePlace: Mock<(id: string, updates: UpdatePlaceInput) => void>;
  let onDeletePlace: Mock<(id: string) => void>;
  let onSetStartCoord: Mock<(coord: Coordinate) => void>;
  let onSetEndCoord: Mock<(coord: Coordinate) => void>;
  let onCenterMap: Mock<(coord: Coordinate) => void>;

  beforeEach(() => {
    onCreatePlace = vi.fn();
    onUpdatePlace = vi.fn();
    onDeletePlace = vi.fn();
    onSetStartCoord = vi.fn();
    onSetEndCoord = vi.fn();
    onCenterMap = vi.fn();
  });

  it('renders panel header, add place button, and empty list message when empty', async () => {
    const user = userEvent.setup();

    render(
      <PlacesPanel
        places={[]}
        onCreatePlace={onCreatePlace}
        onUpdatePlace={onUpdatePlace}
        onDeletePlace={onDeletePlace}
      />,
    );

    expect(
      screen.getByText('Define places and anchor points for precomputed routing.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Place/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        'No places configured yet. Add your home, office, doctor, or regular destinations above.',
      ),
    ).toBeInTheDocument();

    // Clicking Add Place enters pin placement mode and displays persistent toast
    await user.click(screen.getByRole('button', { name: /Add Place/i }));
    expect(screen.getByText('Click on the map to set place location')).toBeInTheDocument();
    // Modal is NOT opened directly
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('enters pin placement mode and can dismiss via close button or Escape key', async () => {
    const user = userEvent.setup();

    render(
      <PlacesPanel
        places={samplePlaces}
        onCreatePlace={onCreatePlace}
        onUpdatePlace={onUpdatePlace}
        onDeletePlace={onDeletePlace}
      />,
    );

    // Enter pin placement mode
    await user.click(screen.getByRole('button', { name: /Add Place/i }));
    expect(screen.getByText('Click on the map to set place location')).toBeInTheDocument();

    // Dismissing the toast cancels placement mode
    const dismissBtn = screen.getByRole('button', { name: 'Dismiss notification' });
    await user.click(dismissBtn);
    expect(screen.queryByText('Click on the map to set place location')).not.toBeInTheDocument();

    // Re-entering and pressing Escape cancels placement mode
    await user.click(screen.getByRole('button', { name: /Add Place/i }));
    expect(screen.getByText('Click on the map to set place location')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Click on the map to set place location')).not.toBeInTheDocument();
  });

  it('renders list of saved places with names and categories', () => {
    render(
      <PlacesPanel
        places={samplePlaces}
        onCreatePlace={onCreatePlace}
        onUpdatePlace={onUpdatePlace}
        onDeletePlace={onDeletePlace}
      />,
    );

    expect(screen.getByText('Apartment')).toBeInTheDocument();
    expect(screen.getByText('Tech Park Office')).toBeInTheDocument();
    expect(screen.getByText('Dr. Mueller Clinic')).toBeInTheDocument();
    expect(screen.getByText('First floor with bike rack')).toBeInTheDocument();
  });

  it('integrates with pin placement mode to open PlaceModal on map click and create place', async () => {
    const user = userEvent.setup();

    const Wrapper: React.FC = () => {
      const [isPlacing, setIsPlacing] = useState(false);
      const [modalCoord, setModalCoord] = useState<Coordinate | null>(null);

      return (
        <div>
          <PlacesPanel
            places={samplePlaces}
            onCreatePlace={onCreatePlace}
            isPlacingPlace={isPlacing}
            onPlacingPlaceChange={setIsPlacing}
          />
          {isPlacing && (
            <button
              type="button"
              data-testid="mock-map-click"
              onClick={() => {
                setIsPlacing(false);
                setModalCoord({ lat: 48.15, lng: 11.59 });
              }}
            >
              Simulate Map Click
            </button>
          )}
          {modalCoord && (
            <PlaceModal
              isOpen={true}
              initialCoordinates={modalCoord}
              onClose={() => setModalCoord(null)}
              onCreatePlace={onCreatePlace}
            />
          )}
        </div>
      );
    };

    render(<Wrapper />);

    await user.click(screen.getByRole('button', { name: /Add Place/i }));
    expect(screen.getByText('Click on the map to set place location')).toBeInTheDocument();

    await user.click(screen.getByTestId('mock-map-click'));
    expect(screen.queryByText('Click on the map to set place location')).not.toBeInTheDocument();

    // Modal is now open
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Add New Place')).toBeInTheDocument();
    const trigger = within(dialog).getByRole('combobox');
    await user.click(trigger);
    const schoolOpt = within(dialog).getByRole('option', { name: 'School' });
    await user.click(schoolOpt);

    const nameInput = within(dialog).getByLabelText('Name');
    expect(nameInput).toHaveValue('School');
    await user.type(nameInput, ' Campus');

    await user.click(within(dialog).getByRole('button', { name: 'Add Place' }));

    expect(onCreatePlace).toHaveBeenCalledTimes(1);
    expect(onCreatePlace).toHaveBeenCalledWith({
      name: 'School Campus',
      category: 'school',
      lat: 48.15,
      lng: 11.59,
      description: undefined,
    });
  });

  it('supports editing an existing place and saving changes', async () => {
    const user = userEvent.setup();

    render(
      <PlacesPanel
        places={samplePlaces}
        onCreatePlace={onCreatePlace}
        onUpdatePlace={onUpdatePlace}
        onDeletePlace={onDeletePlace}
      />,
    );

    const editBtn = screen.getByRole('button', { name: 'Edit Apartment' });
    await user.click(editBtn);

    expect(screen.getByText('Edit Place')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Apartment');

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Renovated Apartment');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onUpdatePlace).toHaveBeenCalledTimes(1);
    expect(onUpdatePlace).toHaveBeenCalledWith('place-1', {
      name: 'Renovated Apartment',
      category: 'home',
      lat: 48.137,
      lng: 11.575,
      description: 'First floor with bike rack',
    });
  });

  it('cancels editing mode when clicking cancel button', async () => {
    const user = userEvent.setup();

    render(
      <PlacesPanel
        places={samplePlaces}
        onCreatePlace={onCreatePlace}
        onUpdatePlace={onUpdatePlace}
        onDeletePlace={onDeletePlace}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit Apartment' }));
    expect(screen.getByText('Edit Place')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);

    expect(screen.queryByText('Edit Place')).not.toBeInTheDocument();
  });

  it('deletes place when clicking delete button', async () => {
    const user = userEvent.setup();

    render(
      <PlacesPanel
        places={samplePlaces}
        onCreatePlace={onCreatePlace}
        onUpdatePlace={onUpdatePlace}
        onDeletePlace={onDeletePlace}
      />,
    );

    const deleteBtn = screen.getByRole('button', { name: 'Delete Apartment' });
    await user.click(deleteBtn);

    expect(onDeletePlace).toHaveBeenCalledTimes(1);
    expect(onDeletePlace).toHaveBeenCalledWith('place-1');
  });

  it('filters places by search query and category', async () => {
    const user = userEvent.setup();

    render(
      <PlacesPanel
        places={samplePlaces}
        onCreatePlace={onCreatePlace}
        onUpdatePlace={onUpdatePlace}
        onDeletePlace={onDeletePlace}
      />,
    );

    const searchInput = screen.getByRole('textbox', { name: 'Search places' });
    await user.type(searchInput, 'Clinic');

    expect(screen.getByText('Dr. Mueller Clinic')).toBeInTheDocument();
    expect(screen.queryByText('Apartment')).not.toBeInTheDocument();
    expect(screen.queryByText('Tech Park Office')).not.toBeInTheDocument();
  });

  it('triggers routing origin and destination callbacks from place actions', async () => {
    const user = userEvent.setup();

    render(
      <PlacesPanel
        places={samplePlaces}
        onCreatePlace={onCreatePlace}
        onUpdatePlace={onUpdatePlace}
        onDeletePlace={onDeletePlace}
        onSetStartCoord={onSetStartCoord}
        onSetEndCoord={onSetEndCoord}
        onCenterMap={onCenterMap}
      />,
    );

    const setStartButtons = screen.getAllByRole('button', { name: 'Set Start' });
    await user.click(setStartButtons[0]!);

    expect(onSetStartCoord).toHaveBeenCalledWith({
      lat: 48.137,
      lng: 11.575,
    });

    const setDestButtons = screen.getAllByRole('button', { name: 'Set Dest' });
    await user.click(setDestButtons[0]!);

    expect(onSetEndCoord).toHaveBeenCalledWith({
      lat: 48.137,
      lng: 11.575,
    });

    const viewButtons = screen.getAllByRole('button', { name: 'View' });
    await user.click(viewButtons[0]!);

    expect(onCenterMap).toHaveBeenCalledWith({
      lat: 48.137,
      lng: 11.575,
    });
  });
});
