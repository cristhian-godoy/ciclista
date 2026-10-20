import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders default badge with children', () => {
    render(<Badge>Default Badge</Badge>);
    const badge = screen.getByText('Default Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('ciclista-badge');
  });

  it('renders with variant class name', () => {
    render(<Badge variant="pass">Passed</Badge>);
    const badge = screen.getByText('Passed');
    expect(badge).toHaveClass('ciclista-badge--pass');
  });

  it('renders with small size class', () => {
    render(
      <Badge size="sm" variant="tag">
        cycleway
      </Badge>,
    );
    const badge = screen.getByText('cycleway');
    expect(badge).toHaveClass('ciclista-badge--sm');
    expect(badge).toHaveClass('ciclista-badge--tag');
  });

  it('renders leading icon if provided', () => {
    render(<Badge icon={<span data-testid="test-icon">★</span>}>Starred</Badge>);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('Starred')).toBeInTheDocument();
  });
});
