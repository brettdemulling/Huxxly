// Generic in-memory TTL cache.
// Interface is stable — swap the backing store (Redis, Upstash, Vercel KV) without touching callers.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface Cache<T> {
  get(key: string): T | null;
  set(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
}

export function createCache<T>(defaultTtlMs = 5 * 60 * 1000): Cache<T> {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | null {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
      return entry.value;
    },
    set(key: string, value: T, ttlMs = defaultTtlMs): void {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    delete(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}
