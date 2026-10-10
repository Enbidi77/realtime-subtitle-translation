export class BoundedAudioQueue<T> {
  private queue: T[] = [];
  private readonly maxCapacity: number;
  private droppedCount = 0;

  constructor(maxCapacity = 20) {
    this.maxCapacity = Math.max(2, maxCapacity);
  }

  public push(item: T): boolean {
    if (this.queue.length >= this.maxCapacity) {
      // Drop oldest chunk to prevent unbounded buffer accumulation
      this.queue.shift();
      this.droppedCount++;
      this.queue.push(item);
      return false; // indicates backpressure drop occurred
    }
    this.queue.push(item);
    return true;
  }

  public pop(): T | undefined {
    return this.queue.shift();
  }

  public peek(): T | undefined {
    return this.queue[0];
  }

  public clear(): void {
    this.queue = [];
    this.droppedCount = 0;
  }

  public get length(): number {
    return this.queue.length;
  }

  public get fillRatio(): number {
    return this.queue.length / this.maxCapacity;
  }

  public get dropped(): number {
    return this.droppedCount;
  }
}
