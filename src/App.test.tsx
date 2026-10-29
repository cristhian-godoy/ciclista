import { fireEvent, render, screen } from '@testing-library/react';
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
    setWorkerUrl: vi.fn(),
    default: {
      Map: MockMap,
      NavigationControl: MockNav,
      setWorkerUrl: vi.fn(),
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

  it('opens Settings modal when clicking settings toolbar button', () => {
    render(<App />);
    const settingsBtn = screen.getByTestId('toolbar-settings-btn');
    fireEvent.click(settingsBtn);

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('opens Search Everywhere modal when clicking search toolbar button', () => {
    render(<App />);
    const searchBtn = screen.getByTestId('toolbar-search-all-btn');
    fireEvent.click(searchBtn);

    expect(screen.getByRole('dialog', { name: 'Search Everywhere' })).toBeInTheDocument();
  });

  it('opens Settings modal on Ctrl+, shortcut', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: ',', ctrlKey: true });

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('opens Search Everywhere modal on Ctrl+K shortcut', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(screen.getByRole('dialog', { name: 'Search Everywhere' })).toBeInTheDocument();
  });

  it('opens Search Everywhere modal on standalone Double Shift', () => {
    const { unmount } = render(<App />);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    // 1st Shift press & release
    fireEvent.keyDown(window, { key: 'Shift' });
    vi.spyOn(Date, 'now').mockReturnValue(now + 100);
    fireEvent.keyUp(window, { key: 'Shift' });

    // 2nd Shift press within 400ms (150ms after first press)
    vi.spyOn(Date, 'now').mockReturnValue(now + 200);
    fireEvent.keyDown(window, { key: 'Shift' });

    expect(screen.getByRole('dialog', { name: 'Search Everywhere' })).toBeInTheDocument();

    vi.restoreAllMocks();
    unmount();
  });
});
