import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OsmTagTable } from './OsmTagTable';

describe('OsmTagTable', () => {
  it('renders empty message when tags are empty', () => {
    render(<OsmTagTable tags={{}} />);
    expect(screen.getByText('OSM Tags')).toBeInTheDocument();
    expect(screen.getByText('No tags available')).toBeInTheDocument();
  });

  it('renders all key value pairs in tag table', () => {
    const tags = {
      highway: 'traffic_signals',
      crossing: 'traffic_signals',
      button_operated: 'yes',
    };

    render(<OsmTagTable tags={tags} />);
    expect(screen.getByText('highway')).toBeInTheDocument();
    expect(screen.getByText('crossing')).toBeInTheDocument();
    expect(screen.getByText('button_operated')).toBeInTheDocument();
    expect(screen.getByText('yes')).toBeInTheDocument();
  });
});
