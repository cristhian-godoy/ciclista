/**
 * A standard Min-Heap Priority Queue for Dijkstra performance.
 */
export class MinHeap<T> {
  private heap: { element: T; priority: number }[] = [];

  /**
   *
   */
  push(element: T, priority: number) {
    this.heap.push({ element, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   *
   */
  pop(): T | null {
    if (this.heap.length === 0) return null;
    const top = this.heap[0].element;
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  /**
   *
   */
  isEmpty() {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number) {
    const node = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (node.priority >= parent.priority) break;
      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = node;
  }

  private sinkDown(index: number) {
    const length = this.heap.length;
    const node = this.heap[index];
    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swapIndex = -1;

      if (leftChildIndex < length) {
        if (this.heap[leftChildIndex].priority < node.priority) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        const rightChild = this.heap[rightChildIndex];
        const leftChild = this.heap[leftChildIndex];
        if (
          (swapIndex === -1 && rightChild.priority < node.priority) ||
          (swapIndex !== -1 && rightChild.priority < leftChild.priority)
        ) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === -1) break;
      this.heap[index] = this.heap[swapIndex];
      index = swapIndex;
    }
    this.heap[index] = node;
  }
}
