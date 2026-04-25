import { IngredientCanonical, CartCanonical, StoreProvider } from '@/lib/core/canonicalModels';
import { getAdapter } from '@/lib/adapters';
import { checkInventory } from '@/lib/inventory/inventoryService';
import { selectBestProducts } from './productEngine';
import { resolveUnavailableItems } from './substitutionEngine';
import { StoreInfo } from '@/lib/core/canonicalModels';
import { logEvent } from '@/lib/events/eventLogger';
import { trackEvent } from '@/lib/analytics/checkoutTelemetry';

export interface CartBuildResult {
  cart: CartCanonical;
  provider: StoreProvider;
  substitutionsApplied: number;
}

export async function buildOptimalCart(
  ingredients: IngredientCanonical[],
  store: StoreInfo,
  userId: string,
  budgetCents: number,
  rejectedSubs: string[] = [],
): Promise<CartBuildResult> {
  const provider = store.provider;
  const zip = store.zipCode;
  const sessionId = `cart:${userId}:${store.id}`;

  try {
    const inventoryResults = await checkInventory(ingredients, zip, provider, userId);
    const available = inventoryResults.filter((r) => r.available);
    const unavailable = inventoryResults.filter((r) => !r.available);

    const productMap = selectBestProducts(
      available.map((r) => ({ ingredient: r.ingredient, products: r.products })),
      budgetCents,
    );

    let substitutionsApplied = 0;
    if (unavailable.length > 0) {
      const subs = await resolveUnavailableItems(
        unavailable.map((r) => r.ingredient),
        provider,
        zip,
        rejectedSubs,
      );
      for (const sub of subs) {
        if (sub.substituteProduct) {
          productMap.set(sub.originalIngredient.id, sub.substituteProduct);
          substitutionsApplied++;
        }
      }
    }

    const products = Array.from(productMap.values());
    const adapter = getAdapter(provider);
    const cart = await adapter.buildCart(products, userId, store.id);

    await logEvent('cart_built', userId, {
      provider,
      storeId: store.id,
      itemCount: cart.items.length,
      subtotalCents: cart.subtotalCents,
      substitutionsApplied,
      coverageScore: cart.coverageScore,
    }, zip);

    trackEvent({
      userId,
      sessionId,
      cartId: cart.id,
      store: store.name,
      eventType: 'cart_build_completed',
      timestamp: Date.now(),
      metadata: { totalCost: cart.estimatedTotalCents / 100 },
    });

    return { cart, provider, substitutionsApplied };
  } catch (err) {
    trackEvent({
      userId,
      sessionId,
      store: store.name,
      eventType: 'cart_build_failed',
      timestamp: Date.now(),
      metadata: { error: err instanceof Error ? err.message : 'unknown' },
    });
    throw err;
  }
}

export function optimizeCartCost(carts: CartCanonical[]): CartCanonical {
  if (!carts.length) throw new Error('No carts to optimize');
  return carts.reduce((best, cart) =>
    cart.estimatedTotalCents < best.estimatedTotalCents ? cart : best,
  );
}

export function minimizeFragmentation(carts: CartCanonical[]): CartCanonical {
  return carts.reduce((best, cart) =>
    cart.coverageScore > best.coverageScore ? cart : best,
  );
}
