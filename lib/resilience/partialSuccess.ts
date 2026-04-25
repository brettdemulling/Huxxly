// ─── Partial Success ──────────────────────────────────────────────────────────
// Ensures the system NEVER fully fails — always returns usable output.
// Callers receive a PartialSuccessResponse even when all providers are down.

import type { CartCanonical, StoreProvider } from '@/lib/core/canonicalModels';
import type { DegradationMode } from './gracefulDegradation';

export interface PartialSuccessResponse {
  success: boolean;
  partial: boolean;
  cart?: CartCanonical;
  checkoutUrl?: string;
  store?: string;
  provider?: StoreProvider;
  degradationMode: DegradationMode;
  retryHint?: string;
  userMessage: string;
  failedProviders: string[];
}

const USER_MESSAGES: Record<DegradationMode, string> = {
  FULL: 'Your cart is ready.',
  LITE_CHECKOUT: 'Your cart is ready (price comparison temporarily unavailable).',
  SINGLE_STORE_ONLY: 'Checkout ready via one store — others are temporarily unavailable.',
  CACHED_MEAL_PLAN: 'Stores are temporarily down. Your meal plan is ready — try checkout again in a few minutes.',
};

export function buildPartialCart(
  existingCart: CartCanonical | undefined,
  provider: StoreProvider,
  checkoutUrl: string,
  mode: DegradationMode,
  failedProviders: string[],
): PartialSuccessResponse {
  return {
    success: true,
    partial: mode !== 'FULL',
    cart: existingCart,
    checkoutUrl,
    store: existingCart?.storeName,
    provider,
    degradationMode: mode,
    userMessage: USER_MESSAGES[mode],
    failedProviders,
    retryHint: mode !== 'FULL' ? attachRetryHint(mode) : undefined,
  };
}

export function generateFallbackResponse(
  mode: DegradationMode,
  failedProviders: string[],
  partialCart?: CartCanonical,
): PartialSuccessResponse {
  const isCheckoutUnavailable = mode === 'CACHED_MEAL_PLAN';
  return {
    success: !isCheckoutUnavailable,
    partial: true,
    cart: partialCart,
    degradationMode: mode,
    userMessage: USER_MESSAGES[mode],
    failedProviders,
    retryHint: attachRetryHint(mode),
  };
}

export function attachRetryHint(mode: DegradationMode): string {
  switch (mode) {
    case 'LITE_CHECKOUT':
      return 'Price comparison will be available once providers recover (usually < 1 min).';
    case 'SINGLE_STORE_ONLY':
      return 'Additional stores will be available once circuit breakers reset (~30s).';
    case 'CACHED_MEAL_PLAN':
      return 'All checkout providers are temporarily down. Please retry in 1–2 minutes.';
    default:
      return '';
  }
}
