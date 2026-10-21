import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Bike, Chevron, Icon, Pin, Search, X } from './Icon';

describe('Icon Primitives', () => {
  it('renders SVG icon primitives with default and custom attributes', () => {
    const { container: searchContainer } = render(
      <Search size={18} color="red" strokeWidth={3} className="custom-search" />,
    );

    const svg = searchContainer.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('height', '18');
    expect(svg).toHaveAttribute('stroke', 'red');
    expect(svg).toHaveAttribute('stroke-width', '3');
    expect(svg?.getAttribute('class')).toContain('lucide lucide-search custom-search');
  });

  it('renders named icons including Bike and X', () => {
    const { container } = render(
      <div>
        <Bike aria-label="Bicycle" />
        <X aria-label="Close" />
      </div>,
    );

    expect(screen.getByLabelText('Bicycle')).toBeInTheDocument();
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('supports aliases Pin and Chevron', () => {
    const { container } = render(
      <div>
        <Pin aria-label="Location Pin" />
        <Chevron aria-label="Right Arrow" />
      </div>,
    );

    expect(screen.getByLabelText('Location Pin')).toBeInTheDocument();
    expect(screen.getByLabelText('Right Arrow')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('renders via generic <Icon /> component by PascalCase, camelCase, and kebab-case name', () => {
    const { container } = render(
      <div>
        <Icon name="Search" aria-label="Search Pascal" />
        <Icon name="search" aria-label="Search Lower" />
        <Icon name="arrow-up-down" aria-label="Arrow Kebab" />
      </div>,
    );

    expect(screen.getByLabelText('Search Pascal')).toBeInTheDocument();
    expect(screen.getByLabelText('Search Lower')).toBeInTheDocument();
    expect(screen.getByLabelText('Arrow Kebab')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(3);
  });
});
