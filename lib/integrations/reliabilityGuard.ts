import type { StoreProvider } from '@/lib/core/canonicalModels';
import { logEvent } from '@/lib/events/eventLogger';

interface FailureRecord {
  count: number;
  lastFailedAt: number;
}

const FAILURE_WINDOW_MS = 60_000;
const FAILURE_THRESHOLD = 3;
const CALL_TIMEOUT_MS = 8_000;

const failureMap = new Map<string, FailureRecord>();

function getKey(provider: StoreProvider, operation: string) {
  return `${provider}:${operation}`;
}

function recordFailure(provider: StoreProvider, operation: string) {
  const key = getKey(provider, operation);
  const existing = failureMap.get(key);
  const now = Date.now();
  if (existing && now - existing.lastFailedAt < FAILURE_WINDOW_MS) {
    failureMap.set(key, { count: existing.count + 1, lastFailedAt: now });
  } else {
    failureMap.set(key, { count: 1, lastFailedAt: now });
  }
}

export function isProviderDegraded(provider: StoreProvider, operation: string): boolean {
  const key = getKey(provider, operation);
  const record = failureMap.get(key);
  if (!record) return false;
  const expired = Date.now() - record.lastFailedAt > FAILURE_WINDOW_MS;
  if (expired) {
    failureMap.delete(key);
    return false;
  }
  return record.count >= FAILURE_THRESHOLD;
}

export async function withReliabilityGuard<T>(
  provider: StoreProvider,
  operation: string,
  fn: () => Promise<T>,
  userId: string,
  zip: string,
): Promise<T> {
  if (isProviderDegraded(provider, operation)) {
    await logEvent('error_occurred', userId, {
      provider,
      operation,
      reason: 'provider_degraded_circuit_open',
    }, zip);
    throw new Error(`Provider ${provider} is currently degraded for ${operation}`);
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${provider}:${operation} timed out`)), CALL_TIMEOUT_MS),
  );

  try {
    const result = await Promise.race([fn(), timeout]);
    return result;
  } catch (err) {
    recordFailure(provider, operation);
    await logEvent('error_occurred', userId, {
      provider,
      operation,
      error: err instanceof Error ? err.message : 'unknown',
      failureCount: failureMap.get(getKey(provider, operation))?.count ?? 1,
    }, zip);
    throw err;
  }
}

export function getFailureReport(): Array<{ key: string; count: number; lastFailedAt: string }> {
  return Array.from(failureMap.entries()).map(([key, rec]) => ({
    key,
    count: rec.count,
    lastFailedAt: new Date(rec.lastFailedAt).toISOString(),
  }));
}
