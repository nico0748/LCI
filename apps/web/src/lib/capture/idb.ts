import type { PendingBatch, PendingStorage } from "./event-logger.ts";

/**
 * IndexedDB による未 ACK バッチの二重書き（FR-C-38）。
 * 依存を増やさないため idb-keyval 相当を素の API で書く。
 * IndexedDB が使えない環境（プライベートモード等）では開けないので、呼び出し側は失敗を握りつぶしてよい。
 */
const DB_NAME = "lci-capture";
const STORE = "pending_events";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "key" });
        os.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (os: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IdbPendingStorage implements PendingStorage {
  private db: Promise<IDBDatabase> | null = null;
  private get(): Promise<IDBDatabase> {
    this.db ??= openDb();
    return this.db;
  }
  async put(batch: PendingBatch) {
    const db = await this.get();
    await tx(db, "readwrite", (os) => os.put(batch));
  }
  async delete(key: string) {
    const db = await this.get();
    await tx(db, "readwrite", (os) => os.delete(key));
  }
  async list(sessionId: string): Promise<PendingBatch[]> {
    const db = await this.get();
    const all = await tx<PendingBatch[]>(db, "readonly", (os) => os.index("sessionId").getAll(sessionId));
    // seq 順に再送する
    return all.sort((a, b) => (a.events[0]?.seq ?? 0) - (b.events[0]?.seq ?? 0));
  }
}

export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}
