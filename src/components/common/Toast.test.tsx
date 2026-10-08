import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Toast } from './Toast';

describe('Toast Component', () => {
  it('renders message, status role, and polite live region', () => {
    render(<Toast message="Click on the map to set place location" />);

    const toast = screen.getByRole('status');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('Click on the map to set place location');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveClass('ciclista-toast--bottom-right');
  });

  it('renders optional icon and custom action', () => {
    render(
      <Toast
        message="Notice active"
        icon={<span data-testid="test-icon">📍</span>}
        action={<button type="button">Undo</button>}
      />,
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('applies configured position class', () => {
    render(<Toast message="Positioned toast" position="top-left" />);

    const toast = screen.getByRole('status');
    expect(toast).toHaveClass('ciclista-toast--top-left');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onCloseMock = vi.fn();

    render(<Toast message="Dismissable toast" onClose={onCloseMock} />);

    const closeBtn = screen.getByRole('button', { name: 'Dismiss notification' });
    expect(closeBtn).toBeInTheDocument();

    await user.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after specified duration when not persistent', () => {
    vi.useFakeTimers();
    try {
      const onCloseMock = vi.fn();

      render(<Toast message="Timed toast" duration={3000} onClose={onCloseMock} />);

      expect(onCloseMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2999);
      expect(onCloseMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not auto-dismiss when persistent is true even if duration is set', () => {
    vi.useFakeTimers();
    try {
      const onCloseMock = vi.fn();

      render(
        <Toast
          message="Persistent toast"
          persistent={true}
          duration={3000}
          onClose={onCloseMock}
        />,
      );

      vi.advanceTimersByTime(10000);
      expect(onCloseMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
