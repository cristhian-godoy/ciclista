import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { Modal } from './Modal';

describe('Modal Component', () => {
  let onCloseMock: Mock<() => void>;

  beforeEach(() => {
    onCloseMock = vi.fn();
  });

  it('does not render anything when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={onCloseMock}>
        <p>Modal Body</p>
      </Modal>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog content and title when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={onCloseMock} title="Test Modal Title">
        <p>Modal Body Content</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Test Modal Title' })).toBeInTheDocument();
    expect(screen.getByText('Modal Body Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });

  it('invokes onClose when clicking the close button', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen={true} onClose={onCloseMock} title="Dismissible Modal">
        <p>Body</p>
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when clicking the backdrop', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Modal isOpen={true} onClose={onCloseMock}>
        <p>Body</p>
      </Modal>,
    );

    const backdrop = container.querySelector('.ciclista-modal-backdrop');
    expect(backdrop).toBeInTheDocument();

    await user.click(backdrop!);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onClose when clicking inside modal content', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen={true} onClose={onCloseMock}>
        <button type="button">Inside Button</button>
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: 'Inside Button' }));
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('invokes onClose when pressing Escape key', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen={true} onClose={onCloseMock} title="Escape Test">
        <p>Body</p>
      </Modal>,
    );

    await user.keyboard('{Escape}');
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
