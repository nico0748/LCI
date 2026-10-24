export class LRUCache {
  // 注意: node --experimental-strip-types では `constructor(private capacity: number)` のような
  // パラメータプロパティや enum は使えません（型注釈を消すだけで実行するため）
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: number): number {
    return -1;
  }

  put(key: number, value: number): void {}
}
