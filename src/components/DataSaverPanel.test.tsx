import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as dataUsage from '../core/storage/dataUsage';
import { DataSaverPanel } from './DataSaverPanel';

describe('DataSaverPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders title, stats, and select controls', () => {
    vi.spyOn(dataUsage, 'getDataUsage').mockReturnValue({
      wifiBytes: 2 * 1024 * 1024,
      cellularBytes: 1 * 1024 * 1024,
      cacheBytes: 9 * 1024 * 1024,
    });
    vi.spyOn(dataUsage, 'getConnectionType').mockReturnValue('wifi');

    render(<DataSaverPanel />);

    expect(screen.getByText('Data & Cache Saver')).toBeInTheDocument();
    expect(screen.getByText(/3.00 MB/)).toBeInTheDocument();
    expect(screen.getByText(/9.00 MB/)).toBeInTheDocument();
    expect(screen.getByText(/Hit Ratio: 75%/)).toBeInTheDocument();
    expect(screen.getAllByText(/WiFi \/ Ethernet/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Data Saver Mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Cellular Data Policy')).toBeInTheDocument();
  });

  it('shows offline mode indicator when offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    render(<DataSaverPanel />);
    expect(screen.getByText(/Offline Mode/)).toBeInTheDocument();
  });

  it('changes data saver mode via Select primitive', async () => {
    const user = userEvent.setup();
    const setDataSaverSpy = vi.spyOn(dataUsage, 'setDataSaverActive');

    render(<DataSaverPanel />);

    const modeSelect = screen.getByLabelText('Data Saver Mode');
    await user.selectOptions(modeSelect, 'always');

    expect(setDataSaverSpy).toHaveBeenCalledWith(true);
  });

  it('changes cellular data policy via Select primitive', async () => {
    const user = userEvent.setup();
    const setCellularSpy = vi.spyOn(dataUsage, 'setCellularDownloadAllowed');

    render(<DataSaverPanel />);

    const cellularSelect = screen.getByLabelText('Cellular Data Policy');
    await user.selectOptions(cellularSelect, 'allowed');

    expect(setCellularSpy).toHaveBeenCalledWith(true);
  });

  it('handles non-blocking reset stats confirmation', async () => {
    const user = userEvent.setup();
    const clearSpy = vi.spyOn(dataUsage, 'clearDataUsage');

    render(<DataSaverPanel />);

    const resetBtn = screen.getByRole('button', { name: /Reset Stats/i });
    await user.click(resetBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Reset all network transfer counters to zero\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmBtn);

    expect(clearSpy).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/reset to zero/i);
  });

  it('handles non-blocking clear cache confirmation', async () => {
    const user = userEvent.setup();
    const deleteCacheMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'caches', {
      value: { delete: deleteCacheMock },
      configurable: true,
      writable: true,
    });

    render(<DataSaverPanel />);

    const clearBtn = screen.getByRole('button', { name: /Clear Cache/i });
    await user.click(clearBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Clear all cached street segments/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(deleteCacheMock).toHaveBeenCalled();
    });
    expect(screen.getByRole('status')).toHaveTextContent(/cleared successfully/i);
  });
});
