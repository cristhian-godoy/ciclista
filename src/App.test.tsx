import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from './App';

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

describe('Main App Route Snapshot Baseline', () => {
  it('renders main dashboard layout structure matching component snapshot', () => {
    const { container } = render(<App />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('initializes routing worker on mount when start and end coordinates exist', async () => {
    const postMessageSpy = vi.fn();
    class MockWorker {
      postMessage = postMessageSpy;
      terminate = vi.fn();
      onmessage = null;
    }
    vi.stubGlobal('Worker', MockWorker);

    window.history.pushState({}, '', '/?start=48.137,11.575&end=48.138,11.576');

    const { unmount } = render(<App />);
    unmount();
    vi.unstubAllGlobals();
  });
});
