import { logEvent } from '@/lib/events/eventLogger';

export type CacheNamespace = 'meals' | 'products' | 'stores' | 'inventory';

interface WriteAttempt {
  namespace: CacheNamespace;
  key: string;
  timestamp: number;
}

// Tracks keys written in this process lifetime to detect redundant/conflicting writes
const recentWrites = new Map<string, WriteAttempt>();
const WRITE_WINDOW_MS = 5000; // flag duplicate writes within 5s as suspicious

/**
 * Validates a proposed cache write.
 * Logs a violation event if the same key is being written twice within the
 * dedup window, which indicates a caller bypassed the gateway.
 *
 * Returns true if the write is allowed, false if it should be suppressed.
 */
export async function guardWrite(
  namespace: CacheNamespace,
  key: string,
  userId = 'system',
): Promise<boolean> {
  const compositeKey = `${namespace}:${key}`;
  const now = Date.now();
  const last = recentWrites.get(compositeKey);

  if (last && now - last.timestamp < WRITE_WINDOW_MS) {
    await logEvent('error_occurred', userId, {
      type: 'CACHE_VIOLATION',
      message: `Duplicate write to ${compositeKey} within ${WRITE_WINDOW_MS}ms — possible bypass of cacheGateway`,
      namespace,
      key,
    }).catch(() => {});
    // Allow the write anyway but log it — we never silently drop data
  }

  recentWrites.set(compositeKey, { namespace, key, timestamp: now });

  // Prune old entries to prevent unbounded memory growth
  if (recentWrites.size > 2000) {
    const cutoff = now - 60_000;
    for (const [k, v] of recentWrites) {
      if (v.timestamp < cutoff) recentWrites.delete(k);
    }
  }

  return true;
}

/**
 * Validates a read attempt. Currently permissive (reads never violate rules),
 * but hooks into the guard pattern for future access-control policies.
 */
export function guardRead(_namespace: CacheNamespace, _key: string): boolean {
  return true;
}

/**
 * Determines which additional keys must be invalidated when a namespace is written.
 * Encodes the cross-namespace invalidation rules in one place.
 *
 * Returns a list of { namespace, keyPattern } objects for the gateway to act on.
 */
export function getInvalidationCascade(
  namespace: CacheNamespace,
  key: string,
): Array<{ namespace: CacheNamespace; keyPattern: string }> {
  switch (namespace) {
    case 'inventory':
      // Writing inventory truth invalidates stale product search results for the same location
      return [{ namespace: 'products', keyPattern: key.split(':')[0] }]; // key = "provider-zip"

    case 'meals':
      // Writing a new meal plan doesn't cascade — meal plan is source of truth
      return [];

    case 'products':
      // Writing a product search result invalidates inventory (different freshness)
      return [];

    case 'stores':
      // Writing store list doesn't cascade
      return [];

    default:
      return [];
  }
}
