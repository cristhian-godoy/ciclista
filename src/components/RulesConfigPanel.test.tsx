import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { RulesConfigPanel, DEFAULT_RULES_CONFIG } from './RulesConfigPanel';

describe('RulesConfigPanel', () => {
  it('renders section headers and reset button', () => {
    render(<RulesConfigPanel config={DEFAULT_RULES_CONFIG} onChange={vi.fn()} />);

    expect(screen.getByText('Road Rules')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Traffic Signs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Road Classes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Intersections/i })).toBeInTheDocument();
  });

  it('reveals traffic signs lists when expanded', async () => {
    const user = userEvent.setup();
    render(<RulesConfigPanel config={DEFAULT_RULES_CONFIG} onChange={vi.fn()} />);

    expect(screen.queryByText('Pedestrian Zone')).not.toBeInTheDocument();

    const signsBtn = screen.getByRole('button', { name: /Traffic Signs/i });
    await user.click(signsBtn);

    expect(screen.getByText('Pedestrian Zone')).toBeInTheDocument();
    expect(screen.getByText('Shared Path')).toBeInTheDocument();
    expect(screen.getByText('Bicycle Street')).toBeInTheDocument();
  });

  it('triggers onChange with DEFAULT_RULES_CONFIG when reset is clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    // Pass a slightly modified config to check that resetting triggers with defaults
    const modifiedConfig = {
      ...DEFAULT_RULES_CONFIG,
      nodeDelays: {
        signalSeconds: 99,
        yieldSeconds: 99,
        stopSeconds: 99,
        crossingSeconds: 99,
      },
    };

    render(<RulesConfigPanel config={modifiedConfig} onChange={handleChange} />);

    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    await user.click(resetBtn);

    expect(handleChange).toHaveBeenCalledWith(DEFAULT_RULES_CONFIG);
  });

  it('reveals intersection delay sliders when intersections toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<RulesConfigPanel config={DEFAULT_RULES_CONFIG} onChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Traffic Light/ })).not.toBeInTheDocument();

    const intersectionsBtn = screen.getByRole('button', { name: /Intersections/i });
    await user.click(intersectionsBtn);

    expect(screen.getByRole('button', { name: /Traffic Light/ })).toBeInTheDocument();
  });
});
