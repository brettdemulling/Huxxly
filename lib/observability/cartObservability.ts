// ─── Cart Observability ───────────────────────────────────────────────────────
// Async-only. NEVER blocks UI or checkout path.
// All functions are fire-and-forget — errors are swallowed silently.
// Tracks: checkout success rate, fallback usage, cart completion,
//         image load success, latency per stage.

import type { FlowState } from '@/lib/ux/stateMachine';
import { trackEvent } from '@/lib/analytics/checkoutTelemetry';

type Provider = 'instacart' | 'kroger' | 'walmart';

function fire(fn: () => void): void {
  try { fn(); } catch { /* observability must never surface */ }
}

// ─── Checkout success ─────────────────────────────────────────────────────────

export function trackCheckoutSuccess(
  userId: string,
  provider: Provider,
  totalCents: number,
): void {
  fire(() => {
    trackEvent({
      userId,
      eventType: 'checkout_attempt_success',
      timestamp: Date.now(),
      store: provider,
      metadata: { totalCost: totalCents / 100 },
    });
  });
}

// ─── Fallback usage ───────────────────────────────────────────────────────────

export function trackFallbackUsage(
  userId: string,
  originalProvider: Provider,
  fallbackProvider: Provider,
): void {
  fire(() => {
    trackEvent({
      userId,
      eventType: 'store_fallback_triggered',
      timestamp: Date.now(),
      store: fallbackProvider,
      metadata: { fallbackStore: fallbackProvider },
    });
  });
}

// ─── Cart completion ──────────────────────────────────────────────────────────

export function trackCartCompletion(
  userId: string,
  cartId: string,
  provider: Provider,
  itemCount: number,
): void {
  fire(() => {
    trackEvent({
      userId,
      cartId,
      eventType: 'cart_build_completed',
      timestamp: Date.now(),
      store: provider,
      metadata: { totalCost: itemCount },
    });
  });
}

// ─── Image load ───────────────────────────────────────────────────────────────

export function trackImageLoad(
  userId: string,
  productId: string,
  success: boolean,
  confidence: number,
): void {
  fire(() => {
    trackEvent({
      userId,
      eventType: success ? 'checkout_attempt_success' : 'checkout_attempt_failed',
      timestamp: Date.now(),
      metadata: { error: success ? undefined : `image_load_failed:${productId}:confidence=${confidence}` },
    });
  });
}

// ─── Stage latency ────────────────────────────────────────────────────────────

const stageTimers: Map<string, number> = new Map();

export function startStageTimer(key: string): void {
  stageTimers.set(key, Date.now());
}

export function endStageTimer(
  userId: string,
  key: string,
  state: FlowState,
): void {
  fire(() => {
    const start = stageTimers.get(key);
    if (!start) return;
    stageTimers.delete(key);
    const latencyMs = Date.now() - start;
    trackEvent({
      userId,
      eventType: 'checkout_attempt_success',
      timestamp: Date.now(),
      metadata: { totalCost: latencyMs, error: `latency:${state}:${latencyMs}ms` },
    });
  });
}
