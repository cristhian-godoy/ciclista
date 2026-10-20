import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CloseButton } from './CloseButton';

describe('CloseButton Component', () => {
  it('renders with default label, title, and aria-label', () => {
    render(<CloseButton />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('title', 'Close');
    expect(btn).toHaveClass('ciclista-close-btn');
  });

  it('handles click callback', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<CloseButton onClick={handleClick} label="Dismiss dialog" />);

    const btn = screen.getByRole('button', { name: 'Dismiss dialog' });
    await user.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant and size classes', () => {
    render(<CloseButton variant="modal" size="lg" />);
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn).toHaveClass('ciclista-close-btn--modal');
    expect(btn).toHaveClass('ciclista-close-btn--lg');
  });

  it('renders custom icon when provided', () => {
    render(<CloseButton icon={<span data-testid="custom-icon">×</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
