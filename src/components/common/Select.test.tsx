import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './Select';

describe('Select primitive', () => {
  const options = [
    { value: 'opt-1', label: 'Option 1' },
    { value: 'opt-2', label: 'Option 2' },
    { value: 'opt-3', label: 'Option 3', disabled: true },
  ];

  it('renders select with options and handles value change', () => {
    const handleChange = vi.fn();
    render(<Select label="Test Label" value="opt-1" onChange={handleChange} options={options} />);

    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('opt-1');

    fireEvent.change(select, { target: { value: 'opt-2' } });
    expect(handleChange).toHaveBeenCalledWith('opt-2');
  });

  it('respects disabled attribute on select and individual options', () => {
    render(
      <Select
        label="Disabled Select"
        value="opt-1"
        onChange={vi.fn()}
        options={options}
        disabled
      />,
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();

    const disabledOption = screen.getByRole('option', { name: 'Option 3' });
    expect(disabledOption).toBeDisabled();
  });
});
