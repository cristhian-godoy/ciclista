import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  formatDistance,
  formatDuration,
  formatTime,
  getCategoryIcon,
  getStrategyLabel,
} from './formatters';

describe('formatters utility', () => {
  describe('formatDistance', () => {
    it('formats distances under 1000m as whole meters', () => {
      expect(formatDistance(0)).toBe('0 m');
      expect(formatDistance(450.4)).toBe('450 m');
      expect(formatDistance(999.4)).toBe('999 m');
    });

    it('formats distances 1000m and above as kilometers with default precision of 2', () => {
      expect(formatDistance(1000)).toBe('1.00 km');
      expect(formatDistance(1250)).toBe('1.25 km');
      expect(formatDistance(10500)).toBe('10.50 km');
    });

    it('formats kilometers with custom precision', () => {
      expect(formatDistance(1250, 1)).toBe('1.3 km');
      expect(formatDistance(1200, 1)).toBe('1.2 km');
      expect(formatDistance(1250, 0)).toBe('1 km');
    });
  });

  describe('formatDuration', () => {
    it('formats durations under 60 seconds as seconds', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(45.2)).toBe('45s');
      expect(formatDuration(59)).toBe('59s');
    });

    it('formats durations between 1 minute and 1 hour as minutes and seconds', () => {
      expect(formatDuration(60)).toBe('1m 0s');
      expect(formatDuration(150)).toBe('2m 30s');
      expect(formatDuration(3599)).toBe('59m 59s');
    });

    it('formats durations 1 hour and above as hours, minutes, and seconds', () => {
      expect(formatDuration(3600)).toBe('1h 0m 0s');
      expect(formatDuration(3665)).toBe('1h 1m 5s');
    });
  });

  describe('formatTime', () => {
    it('formats time strictly as minutes and seconds', () => {
      expect(formatTime(0)).toBe('0m 0s');
      expect(formatTime(45)).toBe('0m 45s');
      expect(formatTime(120)).toBe('2m 0s');
      expect(formatTime(150)).toBe('2m 30s');
    });
  });

  describe('getStrategyLabel', () => {
    it('renders speed badge for standard strategy', () => {
      render(<div>{getStrategyLabel('standard')}</div>);
      expect(screen.getByText('Speed')).toBeInTheDocument();
      expect(screen.getByLabelText('Speed Icon')).toBeInTheDocument();
    });

    it('renders avoid stops badge with full text by default', () => {
      render(<div>{getStrategyLabel('avoid-stops')}</div>);
      expect(screen.getByText('Avoid Stops')).toBeInTheDocument();
      expect(screen.getByLabelText('Avoid Stops Icon')).toBeInTheDocument();
    });

    it('renders compact avoid stops badge when compact option is true', () => {
      render(<div>{getStrategyLabel('avoid-stops', { compact: true, iconSize: 12 })}</div>);
      expect(screen.getByText('Stops')).toBeInTheDocument();
      expect(screen.getByLabelText('Stops Icon')).toBeInTheDocument();
    });

    it('renders quiet paths badge with full text by default', () => {
      render(<div>{getStrategyLabel('quiet-streets')}</div>);
      expect(screen.getByText('Quiet Paths')).toBeInTheDocument();
      expect(screen.getByLabelText('Quiet Paths Icon')).toBeInTheDocument();
    });

    it('renders compact quiet badge when compact option is true', () => {
      render(<div>{getStrategyLabel('quiet-streets', { compact: true, iconSize: 12 })}</div>);
      expect(screen.getByText('Quiet')).toBeInTheDocument();
      expect(screen.getByLabelText('Quiet Icon')).toBeInTheDocument();
    });

    it('falls back to string label for unknown strategy', () => {
      expect(getStrategyLabel('custom-strategy')).toBe('custom-strategy');
    });
  });

  describe('getCategoryIcon', () => {
    it('returns icon node for recognized categories', () => {
      const { container } = render(<div>{getCategoryIcon('home')}</div>);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('falls back to MapPin icon for unrecognized category', () => {
      const { container } = render(<div>{getCategoryIcon('unknown')}</div>);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
