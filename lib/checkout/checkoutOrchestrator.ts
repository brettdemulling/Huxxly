import type { CartCanonical, StoreProvider } from '@/lib/core/canonicalModels';
import { rankStores } from '@/lib/geo/storeScoring';
import { getAdapter } from '@/lib/adapters';
import { logEvent } from '@/lib/events/eventLogger';
import { trackEvent } from '@/lib/analytics/checkoutTelemetry';
import { isAllowed, trackRequest, calculateBackoff } from '@/lib/resilience/adaptiveThrottling';
import { detectDegradationMode, executeDegradedFlow } from '@/lib/resilience/gracefulDegradation';
import { generateFallbackResponse, buildPartialCart, type PartialSuccessResponse } from '@/lib/resilience/partialSuccess';

export interface CheckoutUser {
  id: string;
  zip: string;
}

export interface CheckoutResult {
  success: boolean;
  store: string;
  provider: StoreProvider;
  checkoutUrl: string;
  fallbackApplied: boolean;
  partial?: boolean;
  degraded?: PartialSuccessResponse;
}

export async function buildCheckout(
  user: CheckoutUser,
  cart: CartCanonical,
): Promise<CheckoutResult> {
  const sessionId = `${user.id}:${cart.id}`;

  // Assess system health before attempting providers
  const systemHealth = detectDegradationMode();
  const degradedFlow = executeDegradedFlow(systemHealth);

  trackEvent({
    userId: user.id,
    sessionId,
    cartId: cart.id,
    store: cart.provider,
    eventType: 'checkout_attempt_started',
    timestamp: Date.now(),
    metadata: { totalCost: cart.estimatedTotalCents / 100 },
  });

  // In CACHED_MEAL_PLAN mode all circuits are open — return partial immediately
  if (systemHealth.mode === 'CACHED_MEAL_PLAN') {
    const fallback = generateFallbackResponse(systemHealth.mode, systemHealth.degradedProviders, cart);
    return {
      success: false,
      store: '',
      provider: cart.provider,
      checkoutUrl: '',
      fallbackApplied: false,
      partial: true,
      degraded: fallback,
    };
  }

  let stores = await rankStores(user.zip, cart);

  // In SINGLE_STORE_ONLY mode restrict to one allowed provider
  if (systemHealth.mode === 'SINGLE_STORE_ONLY' && degradedFlow.allowedProviders.length > 0) {
    stores = stores.filter((s) => degradedFlow.allowedProviders.includes(s.provider)).slice(0, 1);
  }

  const attempted: string[] = [];
  const throttledProviders: string[] = [];

  for (const store of stores) {
    // Check adaptive throttle before attempting this provider
    if (!isAllowed(store.provider as StoreProvider)) {
      const backoffMs = calculateBackoff(store.provider as StoreProvider);
      throttledProviders.push(store.provider);
      await logEvent('error_occurred', user.id, {
        provider: store.provider,
        error: `throttled — backoff ${backoffMs}ms`,
        step: 'throttle_check',
      }, user.zip);
      continue;
    }

    attempted.push(store.provider);
    const attemptStart = Date.now();

    try {
      const adapter = getAdapter(store.provider);
      const cartForStore = { ...cart, provider: store.provider, storeId: store.id, storeName: store.name };
      const { checkoutUrl } = await adapter.checkout(cartForStore);

      const latencyMs = Date.now() - attemptStart;
      trackRequest(store.provider as StoreProvider, true, latencyMs);

      if (!checkoutUrl) {
        trackRequest(store.provider as StoreProvider, false, latencyMs);
        continue;
      }

      const fallbackApplied = store.provider !== cart.provider;

      if (fallbackApplied) {
        trackEvent({
          userId: user.id,
          sessionId,
          cartId: cart.id,
          store: store.name,
          eventType: 'store_fallback_triggered',
          timestamp: Date.now(),
          metadata: { fallbackStore: store.provider },
        });
        await logEvent('failover_triggered', user.id, {
          originalProvider: cart.provider,
          successProvider: store.provider,
          attempted,
        }, user.zip);
      }

      trackEvent({
        userId: user.id,
        sessionId,
        cartId: cart.id,
        store: store.name,
        eventType: 'checkout_attempt_success',
        timestamp: Date.now(),
        metadata: { totalCost: cart.estimatedTotalCents / 100 },
      });

      const partial = systemHealth.mode !== 'FULL';
      return {
        success: true,
        store: store.name,
        provider: store.provider,
        checkoutUrl,
        fallbackApplied,
        partial,
        degraded: partial
          ? buildPartialCart(cart, store.provider, checkoutUrl, systemHealth.mode, [...throttledProviders, ...attempted.slice(0, -1)])
          : undefined,
      };
    } catch (err) {
      const latencyMs = Date.now() - attemptStart;
      trackRequest(store.provider as StoreProvider, false, latencyMs);
      await logEvent('error_occurred', user.id, {
        provider: store.provider,
        error: err instanceof Error ? err.message : 'unknown',
        step: 'checkout',
      }, user.zip);
      continue;
    }
  }

  // All providers failed — return partial success instead of throwing
  trackEvent({
    userId: user.id,
    sessionId,
    cartId: cart.id,
    eventType: 'checkout_attempt_failed',
    timestamp: Date.now(),
    metadata: { error: 'all_providers_exhausted' },
  });

  const fallback = generateFallbackResponse(
    attempted.length === 0 ? 'CACHED_MEAL_PLAN' : systemHealth.mode,
    [...throttledProviders, ...attempted],
    cart,
  );

  return {
    success: false,
    store: '',
    provider: cart.provider,
    checkoutUrl: '',
    fallbackApplied: false,
    partial: true,
    degraded: fallback,
  };
}
