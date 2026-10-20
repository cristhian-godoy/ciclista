import { useEffect } from 'react';

/**
 * Attaches a window keydown listener that fires callback when Escape is pressed.
 *
 * @param onEscape - Callback function invoked when Escape key is pressed.
 * @param enabled - Whether the keyboard listener is currently active. Defaults to true.
 */
export function useEscapeKey(onEscape: (() => void) | undefined, enabled = true): void {
  useEffect(() => {
    if (!enabled || !onEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscape, enabled]);
}
