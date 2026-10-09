import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TestRunnerPage from './TestRunnerPage';

// Mock MapLibre GL constructor to avoid WebGL errors in jsdom
vi.mock('maplibre-gl', () => {
  function MockMap() {
    return {
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      remove: vi.fn(),
      addControl: vi.fn(),
      getCanvas: vi.fn(() => ({ style: {} })),
      getSource: vi.fn(),
      addSource: vi.fn(),
      getLayer: vi.fn(),
      addLayer: vi.fn(),
      setStyle: vi.fn(),
      easeTo: vi.fn(),
    };
  }
  const MockNav = vi.fn();
  return {
    Map: MockMap,
    NavigationControl: MockNav,
    default: {
      Map: MockMap,
      NavigationControl: MockNav,
    },
  };
});

describe('TestRunnerPage layout and design system compliance', () => {
  it('renders test dashboard structure matching component snapshots', () => {
    const { container } = render(<TestRunnerPage />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
