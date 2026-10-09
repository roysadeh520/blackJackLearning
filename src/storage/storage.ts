// Persistence layer. The app talks to a StorageAdapter, so local storage can
// later be swapped for cloud sync without touching game or UI code.

export interface StorageAdapter {
  load<T>(key: string): T | undefined;
  save<T>(key: string, value: T): void;
  remove(key: string): void;
}

const PREFIX = 'bjl:v1:';

/** localStorage with an in-memory fallback (private mode, blocked storage). */
export class LocalStorageAdapter implements StorageAdapter {
  private memory = new Map<string, string>();

  private get ls(): Storage | null {
    try {
      const s = window.localStorage;
      const probe = `${PREFIX}probe`;
      s.setItem(probe, '1');
      s.removeItem(probe);
      return s;
    } catch {
      return null;
    }
  }

  load<T>(key: string): T | undefined {
    try {
      const raw = this.ls?.getItem(PREFIX + key) ?? this.memory.get(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  }

  save<T>(key: string, value: T): void {
    const raw = JSON.stringify(value);
    this.memory.set(key, raw);
    try {
      this.ls?.setItem(PREFIX + key, raw);
    } catch {
      /* quota or blocked: the in-memory copy keeps the session working */
    }
  }

  remove(key: string): void {
    this.memory.delete(key);
    try {
      this.ls?.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private data = new Map<string, string>();
  load<T>(key: string): T | undefined {
    const raw = this.data.get(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }
  save<T>(key: string, value: T): void {
    this.data.set(key, JSON.stringify(value));
  }
  remove(key: string): void {
    this.data.delete(key);
  }
}
