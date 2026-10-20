import { type RefObject, useEffect } from 'react';

/**
 * Attaches document mousedown or click listeners to invoke callback when clicking outside referenced element.
 *
 * @param ref - React ref object referencing the target DOM element container.
 * @param handler - Callback function invoked on outside click.
 * @param enabled - Whether the outside click listener is active. Defaults to true.
 * @param mouseEvent - DOM mouse event name to listen for ('mousedown' or 'click'). Defaults to 'mousedown'.
 */
export function useOnClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: ((event: MouseEvent) => void) | undefined,
  enabled = true,
  mouseEvent: 'mousedown' | 'click' = 'mousedown',
): void {
  useEffect(() => {
    if (!enabled || !handler) return;

    const listener = (event: MouseEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener(mouseEvent, listener);
    return () => {
      document.removeEventListener(mouseEvent, listener);
    };
  }, [ref, handler, enabled, mouseEvent]);
}
