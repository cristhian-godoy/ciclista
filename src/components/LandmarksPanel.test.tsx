import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Coordinate } from '../core/common/types';
import type { CreateLandmarkInput, Landmark, UpdateLandmarkInput } from '../core/landmarks/types';
import { LandmarksPanel } from './LandmarksPanel';

describe('LandmarksPanel Component', () => {
  const sampleLandmarks: Landmark[] = [
    {
      id: 'lm-1',
      name: 'Apartment',
      category: 'home',
      lat: 48.137,
      lng: 11.575,
      description: 'First floor with bike rack',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'lm-2',
      name: 'Tech Park Office',
      category: 'work',
      lat: 48.145,
      lng: 11.585,
      createdAt: 2000,
      updatedAt: 2000,
    },
    {
      id: 'lm-3',
      name: 'Dr. Mueller Clinic',
      category: 'doctor',
      lat: 48.12,
      lng: 11.56,
      createdAt: 3000,
      updatedAt: 3000,
    },
  ];

  let onCreateLandmark: Mock<(input: CreateLandmarkInput) => void>;
  let onUpdateLandmark: Mock<(id: string, updates: UpdateLandmarkInput) => void>;
  let onDeleteLandmark: Mock<(id: string) => void>;
  let onSetStartCoord: Mock<(coord: Coordinate) => void>;
  let onSetEndCoord: Mock<(coord: Coordinate) => void>;
  let onCenterMap: Mock<(coord: Coordinate) => void>;

  beforeEach(() => {
    onCreateLandmark = vi.fn();
    onUpdateLandmark = vi.fn();
    onDeleteLandmark = vi.fn();
    onSetStartCoord = vi.fn();
    onSetEndCoord = vi.fn();
    onCenterMap = vi.fn();
  });

  it('renders panel header, form fields, and empty list message when empty', () => {
    render(
      <LandmarksPanel
        landmarks={[]}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
      />,
    );

    expect(
      screen.getByText('Define favorite destinations and anchor points for precomputed routing.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
    expect(screen.getByLabelText('Longitude')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No favorite places configured yet. Add your home, office, doctor, or regular destinations above.',
      ),
    ).toBeInTheDocument();
  });

  it('renders list of saved landmarks with names and categories', () => {
    render(
      <LandmarksPanel
        landmarks={sampleLandmarks}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
      />,
    );

    expect(screen.getByText('Apartment')).toBeInTheDocument();
    expect(screen.getByText('Tech Park Office')).toBeInTheDocument();
    expect(screen.getByText('Dr. Mueller Clinic')).toBeInTheDocument();
    expect(screen.getByText('First floor with bike rack')).toBeInTheDocument();
  });

  it('validates form and prevents submission when name or coordinates are invalid', async () => {
    const user = userEvent.setup();

    render(
      <LandmarksPanel
        landmarks={sampleLandmarks}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Add Favorite Place' });
    await user.click(submitBtn);

    expect(onCreateLandmark).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Landmark name must not be empty.')).toBeInTheDocument();
  });

  it('creates a new landmark on valid form submission', async () => {
    const user = userEvent.setup();

    render(
      <LandmarksPanel
        landmarks={sampleLandmarks}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Boutique Gym');
    await user.selectOptions(screen.getByLabelText('Category'), 'leisure');
    await user.type(screen.getByLabelText('Latitude'), '48.15');
    await user.type(screen.getByLabelText('Longitude'), '11.59');
    await user.type(screen.getByLabelText('Notes / Description (Optional)'), 'Has shower');

    await user.click(screen.getByRole('button', { name: 'Add Favorite Place' }));

    expect(onCreateLandmark).toHaveBeenCalledTimes(1);
    expect(onCreateLandmark).toHaveBeenCalledWith({
      name: 'Boutique Gym',
      category: 'leisure',
      lat: 48.15,
      lng: 11.59,
      description: 'Has shower',
    });
  });

  it('prefills coordinates when clicking quick point buttons', async () => {
    const user = userEvent.setup();

    render(
      <LandmarksPanel
        landmarks={sampleLandmarks}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
        currentMapCenter={{ lat: 48.139, lng: 11.579 }}
        startCoord={{ lat: 48.111, lng: 11.222 }}
      />,
    );

    const mapCenterBtn = screen.getByRole('button', { name: /Map Center/i });
    await user.click(mapCenterBtn);

    expect(screen.getByLabelText('Latitude')).toHaveValue(48.139);
    expect(screen.getByLabelText('Longitude')).toHaveValue(11.579);

    const startPinBtn = screen.getByRole('button', { name: /Start Pin/i });
    await user.click(startPinBtn);

    expect(screen.getByLabelText('Latitude')).toHaveValue(48.111);
    expect(screen.getByLabelText('Longitude')).toHaveValue(11.222);
  });

  it('supports editing an existing landmark and saving changes', async () => {
    const user = userEvent.setup();

    render(
      <LandmarksPanel
        landmarks={sampleLandmarks}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
      />,
    );

    const editBtn = screen.getByRole('button', { name: 'Edit Apartment' });
    await user.click(editBtn);

    expect(screen.getByText('Edit Favorite Place')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Apartment');

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Renovated Apartment');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onUpdateLandmark).toHaveBeenCalledTimes(1);
    expect(onUpdateLandmark).toHaveBeenCalledWith('lm-1', {
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
      <LandmarksPanel
        landmarks={sampleLandmarks}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit Apartment' }));
    expect(screen.getByText('Edit Favorite Place')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);

    expect(screen.getByText('Add New Favorite Place')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('deletes landmark when clicking delete button', async () => {
    const user = userEvent.setup();

    render(
      <LandmarksPanel
        landmarks={sampleLandmarks}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
      />,
    );

    const deleteBtn = screen.getByRole('button', { name: 'Delete Apartment' });
    await user.click(deleteBtn);

    expect(onDeleteLandmark).toHaveBeenCalledTimes(1);
    expect(onDeleteLandmark).toHaveBeenCalledWith('lm-1');
  });

  it('filters landmarks by search query and category', async () => {
    const user = userEvent.setup();

    render(
      <LandmarksPanel
        landmarks={sampleLandmarks}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
      />,
    );

    const searchInput = screen.getByRole('textbox', { name: 'Search landmarks' });
    await user.type(searchInput, 'Clinic');

    expect(screen.getByText('Dr. Mueller Clinic')).toBeInTheDocument();
    expect(screen.queryByText('Apartment')).not.toBeInTheDocument();
    expect(screen.queryByText('Tech Park Office')).not.toBeInTheDocument();
  });

  it('triggers routing origin and destination callbacks from landmark actions', async () => {
    const user = userEvent.setup();

    render(
      <LandmarksPanel
        landmarks={sampleLandmarks}
        onCreateLandmark={onCreateLandmark}
        onUpdateLandmark={onUpdateLandmark}
        onDeleteLandmark={onDeleteLandmark}
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
