import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { CategorySelectDropdown } from './CategorySelectDropdown';

describe('CategorySelectDropdown', () => {
  let onSelectCategoryMock: Mock<(cat: string) => void>;

  beforeEach(() => {
    onSelectCategoryMock = vi.fn();
  });

  it('renders trigger button with placeholder when category is empty', () => {
    render(<CategorySelectDropdown category="" onSelectCategory={onSelectCategoryMock} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Select category...');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('displays active category label and icon when category is selected', () => {
    render(<CategorySelectDropdown category="home" onSelectCategory={onSelectCategoryMock} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Home');
  });

  it('opens options list when trigger is clicked and allows selection', async () => {
    const user = userEvent.setup();
    render(<CategorySelectDropdown category="" onSelectCategory={onSelectCategoryMock} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const workOption = screen.getByRole('option', { name: /work/i });
    await user.click(workOption);

    expect(onSelectCategoryMock).toHaveBeenCalledWith('work');
  });

  it('filters options when search query is entered', async () => {
    const user = userEvent.setup();
    render(<CategorySelectDropdown category="" onSelectCategory={onSelectCategoryMock} />);

    await user.click(screen.getByRole('combobox'));

    const searchInput = screen.getByPlaceholderText('Search category...');
    await user.type(searchInput, 'scho');

    expect(screen.getByRole('option', { name: /school/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /home/i })).not.toBeInTheDocument();
  });
});
