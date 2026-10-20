import { describe, expect, it } from 'vitest';

import { MinHeap } from './MinHeap';

describe('MinHeap', () => {
  it('initializes as empty', () => {
    const heap = new MinHeap<string>();
    expect(heap.isEmpty()).toBe(true);
    expect(heap.pop()).toBeNull();
    expect(heap.peek()).toBeNull();
  });

  it('correctly reports non-empty after push and returns peek', () => {
    const heap = new MinHeap<string>();
    heap.push('alpha', 10);
    expect(heap.isEmpty()).toBe(false);
    expect(heap.peek()).toEqual({ element: 'alpha', priority: 10 });
  });

  it('pops elements in ascending priority order', () => {
    const heap = new MinHeap<string>();
    heap.push('medium', 20);
    heap.push('highest', 5);
    heap.push('lowest', 50);
    heap.push('high', 10);
    heap.push('medium-low', 30);

    expect(heap.pop()).toBe('highest');
    expect(heap.pop()).toBe('high');
    expect(heap.pop()).toBe('medium');
    expect(heap.pop()).toBe('medium-low');
    expect(heap.pop()).toBe('lowest');
    expect(heap.isEmpty()).toBe(true);
    expect(heap.pop()).toBeNull();
  });

  it('handles duplicate priorities correctly', () => {
    const heap = new MinHeap<string>();
    heap.push('first', 15);
    heap.push('second', 15);
    heap.push('earlier', 5);

    expect(heap.pop()).toBe('earlier');
    const poppedRest = [heap.pop(), heap.pop()];
    expect(poppedRest).toContain('first');
    expect(poppedRest).toContain('second');
    expect(heap.isEmpty()).toBe(true);
  });

  it('maintains heap invariant with many random values', () => {
    const heap = new MinHeap<number>();
    const values = [42, 17, 93, 8, 24, 65, 3, 11, 88, 55, 1, 99, 14];

    for (const val of values) {
      heap.push(val, val);
    }

    const extracted: number[] = [];
    while (!heap.isEmpty()) {
      const val = heap.pop();
      if (val !== null) {
        extracted.push(val);
      }
    }

    const sorted = [...values].sort((a, b) => a - b);
    expect(extracted).toEqual(sorted);
  });
});
