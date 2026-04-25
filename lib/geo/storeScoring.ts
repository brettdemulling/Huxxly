import type { CartCanonical, StoreInfo } from '@/lib/core/canonicalModels';
import { findNearbyStores } from './storeLocator';
import { isAllowed, trackRequest, type StoreProvider } from '@/lib/resilience/adaptiveThrottling';

export interface StoreScore {
  priceScore: number;
  inventoryScore: number;
  deliveryScore: number;
  reliabilityScore: number;
  total: number;
}

export interface ScoredStore extends StoreInfo {
  score: StoreScore;
}

const PRICE_INDEX: Record<string, number> = {
  walmart: 0.92,
  kroger: 0.97,
  instacart: 1.05,
};

export function scoreStore(store: StoreInfo, cart?: CartCanonical): StoreScore {
  const priceScore = 1 - (PRICE_INDEX[store.provider] ?? 1.0) * 0.1;
  const inventoryScore = store.availabilityConfidence;
  const deliveryScore = store.deliveryCoverageScore;
  const reliabilityScore = store.compositeScore;
  const coverageBonus = cart ? cart.coverageScore * 0.1 : 0;

  const total = Math.min(
    0.3 * priceScore +
    0.3 * inventoryScore +
    0.25 * deliveryScore +
    0.15 * reliabilityScore +
    coverageBonus,
    1.0,
  );

  return {
    priceScore: Math.round(priceScore * 100) / 100,
    inventoryScore: Math.round(inventoryScore * 100) / 100,
    deliveryScore: Math.round(deliveryScore * 100) / 100,
    reliabilityScore: Math.round(reliabilityScore * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export async function rankStores(zip: string, cart?: CartCanonical): Promise<ScoredStore[]> {
  const stores = await findNearbyStores(zip);
  return stores
    .map((s) => ({ ...s, score: scoreStore(s, cart) }))
    // Deprioritize throttled providers by zeroing their score for ranking purposes
    .map((s) => isAllowed(s.provider as StoreProvider) ? s : { ...s, score: { ...s.score, total: 0 } })
    .sort((a, b) => b.score.total - a.score.total);
}

export async function safeCheckout(
  cart: CartCanonical,
  zip: string,
): Promise<{ checkoutUrl: string; store: string } | null> {
  const ranked = await rankStores(zip, cart);
  for (const store of ranked) {
    if (!isAllowed(store.provider as StoreProvider)) continue;

    const start = Date.now();
    try {
      const { getAdapter } = await import('@/lib/adapters');
      const adapter = getAdapter(store.provider);
      const { checkoutUrl } = await adapter.checkout(cart);
      trackRequest(store.provider as StoreProvider, true, Date.now() - start);
      if (checkoutUrl) return { checkoutUrl, store: store.name };
    } catch {
      trackRequest(store.provider as StoreProvider, false, Date.now() - start);
      continue;
    }
  }
  return null;
}
