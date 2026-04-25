import { StoreProvider } from '@/lib/core/canonicalModels';
import { logEvent } from '@/lib/events/eventLogger';
import { metrics } from '@/lib/monitoring/metrics';
import { trackEvent } from '@/lib/analytics/checkoutTelemetry';

const MAX_RETRIES = 2;
const PROVIDER_ORDER: StoreProvider[] = ['instacart', 'kroger', 'walmart'];

export interface FailoverContext {
  userId: string;
  zipCode: string;
  currentProvider: StoreProvider;
}

export class FailoverError extends Error {
  constructor(
    message: string,
    public readonly failedProviders: StoreProvider[],
  ) {
    super(message);
    this.name = 'FailoverError';
  }
}

async function retryOnce<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return retryOnce(fn, attempt + 1);
    }
    throw err;
  }
}

export async function withFailover<T>(
  ctx: FailoverContext,
  fn: (provider: StoreProvider) => Promise<T>,
): Promise<{ result: T; provider: StoreProvider; failoverApplied: boolean }> {
  const tried: StoreProvider[] = [];
  const providerQueue = [
    ctx.currentProvider,
    ...PROVIDER_ORDER.filter((p) => p !== ctx.currentProvider),
  ];

  for (const provider of providerQueue) {
    tried.push(provider);
    try {
      const result = await retryOnce(() => fn(provider));
      const failoverApplied = provider !== ctx.currentProvider;

      if (failoverApplied) {
        metrics.increment('failover_triggered', { from: ctx.currentProvider, to: provider });
        await logEvent('failover_triggered', ctx.userId, {
          originalProvider: ctx.currentProvider,
          successProvider: provider,
          failedProviders: tried.slice(0, -1),
        }, ctx.zipCode);
        trackEvent({
          userId: ctx.userId,
          sessionId: ctx.userId,
          store: provider,
          eventType: 'store_fallback_triggered',
          timestamp: Date.now(),
          metadata: { fallbackStore: provider },
        });
      }

      return { result, provider, failoverApplied };
    } catch (err) {
      metrics.failure(provider, err instanceof Error ? err.message : 'unknown');

      await logEvent('error_occurred', ctx.userId, {
        provider,
        error: err instanceof Error ? err.message : 'unknown',
        attempt: tried.length,
      }, ctx.zipCode);

      if (tried.length === providerQueue.length) {
        throw new FailoverError(
          `All providers failed after failover: ${tried.join(' → ')}`,
          tried,
        );
      }
    }
  }

  throw new FailoverError('Failover exhausted', tried);
}

export function degradeGracefully<T>(fallback: T): (err: unknown) => T {
  return (err) => {
    console.error('[failover] degrading gracefully:', err);
    return fallback;
  };
}
