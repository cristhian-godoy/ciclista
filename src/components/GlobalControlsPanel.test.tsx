import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GlobalControlsPanel } from './GlobalControlsPanel';

describe('GlobalControlsPanel', () => {
  it('renders initial state with theme and data saver buttons', () => {
    render(<GlobalControlsPanel theme="bright" onThemeChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Select Theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Data Saver/i })).toBeInTheDocument();
  });

  it('expands theme menu when theme button is clicked', async () => {
    const user = userEvent.setup();
    render(<GlobalControlsPanel theme="bright" onThemeChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Bright Theme/i })).not.toBeInTheDocument();

    const themeSelectBtn = screen.getByRole('button', { name: /Select Theme/i });
    await user.click(themeSelectBtn);

    expect(screen.getByRole('button', { name: /Bright Theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Liberty Theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dark Theme/i })).toBeInTheDocument();
  });

  it('triggers onThemeChange and closes menu when a theme option is selected', async () => {
    const user = userEvent.setup();
    const handleThemeChange = vi.fn();
    render(<GlobalControlsPanel theme="bright" onThemeChange={handleThemeChange} />);

    const themeSelectBtn = screen.getByRole('button', { name: /Select Theme/i });
    await user.click(themeSelectBtn);

    const darkThemeBtn = screen.getByRole('button', { name: /Dark Theme/i });
    await user.click(darkThemeBtn);

    expect(handleThemeChange).toHaveBeenCalledWith('dark');
    expect(screen.queryByRole('button', { name: /Dark Theme/i })).not.toBeInTheDocument();
  });

  it('closes theme menu when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <div data-testid="outside">Outside Area</div>
        <GlobalControlsPanel theme="bright" onThemeChange={vi.fn()} />
      </div>,
    );

    const themeSelectBtn = screen.getByRole('button', { name: /Select Theme/i });
    await user.click(themeSelectBtn);
    expect(screen.getByRole('button', { name: /Dark Theme/i })).toBeInTheDocument();

    // Click outside
    const outsideEl = screen.getByTestId('outside');
    await user.click(outsideEl);

    expect(screen.queryByRole('button', { name: /Dark Theme/i })).not.toBeInTheDocument();
  });

  it('toggles data saver option state when clicked', async () => {
    const user = userEvent.setup();
    render(<GlobalControlsPanel theme="bright" onThemeChange={vi.fn()} />);

    const dataSaverBtn = screen.getByRole('button', { name: /Data Saver/i });
    const initialText = dataSaverBtn.getAttribute('title');

    await user.click(dataSaverBtn);
    const updatedText = dataSaverBtn.getAttribute('title');

    expect(initialText).not.toEqual(updatedText);
  });
});
