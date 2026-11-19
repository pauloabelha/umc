// Min-heap: insert/remove O(log n); earliest event O(1). Sequence breaks ties.
export class EventQueue {
  #heap = [];
  #sequence = 0;
  peek() {return this.#heap[0] ?? null;}
  #before(a, b) {return a.time < b.time || (a.time === b.time && a.sequence < b.sequence);}
  push(event) {
    const item = {...event, sequence: this.#sequence++};
    const heap = this.#heap;
    let i = heap.length;
    heap.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.#before(item, heap[parent])) break;
      heap[i] = heap[parent]; i = parent;
    }
    heap[i] = item;
  }
  pop() {
    const heap = this.#heap, first = heap[0];
    if (!first) return null;
    const last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (2 * i + 1 < heap.length) {
        let child = 2 * i + 1;
        if (child + 1 < heap.length && this.#before(heap[child + 1], heap[child])) child++;
        if (!this.#before(heap[child], last)) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return first;
  }
}
