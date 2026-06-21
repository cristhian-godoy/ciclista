import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AttributionPanel } from './AttributionPanel';

describe('AttributionPanel', () => {
  it('renders the collapsed headers by default', () => {
    render(<AttributionPanel />);

    const button = screen.getByRole('button', { name: /Attributions/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    // Should not render the attributions list initially
    expect(screen.queryByText('OpenStreetMap')).not.toBeInTheDocument();
    expect(screen.queryByText('MapLibre GL JS')).not.toBeInTheDocument();
  });

  it('reveals attributions when header is clicked', async () => {
    const user = userEvent.setup();
    render(<AttributionPanel />);

    const button = screen.getByRole('button', { name: /Attributions/i });
    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('OpenStreetMap')).toBeInTheDocument();
    expect(screen.getByText('MapLibre GL JS')).toBeInTheDocument();
    expect(screen.getByText('React & React DOM')).toBeInTheDocument();
    expect(screen.getByText('Lucide React')).toBeInTheDocument();
    expect(screen.getByText('Vite, TypeScript & ESLint')).toBeInTheDocument();
  });

  it('collapses attributions when header is clicked again', async () => {
    const user = userEvent.setup();
    render(<AttributionPanel />);

    const button = screen.getByRole('button', { name: /Attributions/i });

    // Expand
    await user.click(button);
    expect(screen.getByText('OpenStreetMap')).toBeInTheDocument();

    // Collapse
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('OpenStreetMap')).not.toBeInTheDocument();
  });
});
