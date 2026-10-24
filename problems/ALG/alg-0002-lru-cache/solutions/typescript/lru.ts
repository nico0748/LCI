/** Map は挿入順を保持するので、delete → set で「最新」へ移し、先頭キーが最古になる */
export class LRUCache {
  private map = new Map<number, number>();
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: number): number {
    const v = this.map.get(key);
    if (v === undefined) return -1;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  put(key: number, value: number): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as number;
      this.map.delete(oldest);
    }
  }
}
