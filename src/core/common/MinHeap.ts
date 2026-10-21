/**
 * A standard Min-Heap Priority Queue for Dijkstra performance.
 */
export class MinHeap<T> {
  private heap: { element: T; priority: number }[] = [];

  /**
   * Pushes a new element into the heap with the specified priority.
   */
  push(element: T, priority: number) {
    this.heap.push({ element, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Removes and returns the element with the lowest priority from the heap.
   */
  pop(): T | null {
    const first = this.heap[0];
    if (!first) return null;
    const top = first.element;
    const bottom = this.heap.pop();
    if (!bottom) return top;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  /**
   * Returns the entry with the lowest priority without removing it from the heap.
   */
  peek(): { element: T; priority: number } | null {
    const first = this.heap[0];
    return first ?? null;
  }

  /**
   * Checks whether the heap contains no elements.
   */
  isEmpty() {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number) {
    const node = this.heap[index];
    if (!node) return;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (!parent || node.priority >= parent.priority) break;
      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = node;
  }

  private sinkDown(index: number) {
    const length = this.heap.length;
    const node = this.heap[index];
    if (!node) return;
    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swapIndex = -1;
      const leftChild = this.heap[leftChildIndex];

      if (leftChildIndex < length && leftChild) {
        if (leftChild.priority < node.priority) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        const rightChild = this.heap[rightChildIndex];
        if (
          rightChild &&
          ((swapIndex === -1 && rightChild.priority < node.priority) ||
            (swapIndex !== -1 && leftChild && rightChild.priority < leftChild.priority))
        ) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === -1) break;
      const swapItem = this.heap[swapIndex];
      if (!swapItem) break;
      this.heap[index] = swapItem;
      index = swapIndex;
    }
    this.heap[index] = node;
  }
}
