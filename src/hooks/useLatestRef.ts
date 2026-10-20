import { type RefObject, useEffect, useRef } from 'react';

/**
 * Persists the latest value inside a mutable React ref updated synchronously on render.
 * Prevents effect invalidation and stale closure issues while accessing latest props or callbacks.
 *
 * @param value - Value to synchronize inside the ref.
 * @returns RefObject containing the latest value.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
