import { CartRepository } from '@/lib/repositories/CartRepository';
import { resolveStores, resolveStore } from '@/lib/domains/stores';
import { applyPricing, sumTotal } from '@/lib/domains/pricing';
import type { CartResult, CartItem, StoreCart } from '@/lib/contracts';

export type { CartResult, CartItem, StoreCart };

export async function runCart(
  userId: string,
  zipCode?: string,
  storeId?: string,
): Promise<CartResult> {
  const saved = await CartRepository.getSavedRecipes(userId);

  if (!saved.length) {
    return { items: [], totalCost: 0, recipeCount: 0 };
  }

  const baseItems = saved.map((s) => ({ name: s.recipe.name, price: s.recipe.price }));

  if (!zipCode) {
    const items: CartItem[] = baseItems.map((i) => ({ name: i.name, estimatedCost: i.price }));
    const totalCost = sumTotal(items.map((i) => ({ adjustedCost: i.estimatedCost })));
    return { items, totalCost, recipeCount: saved.length };
  }

  const [stores, selectedStore] = await Promise.all([
    resolveStores(zipCode),
    resolveStore(zipCode, storeId),
  ]);

  const storesCarts: StoreCart[] = stores.map((store) => {
    const priced = applyPricing(baseItems, store);
    const totalCost = sumTotal(priced);
    return {
      storeId: store.id,
      storeName: store.name,
      priceMultiplier: store.priceMultiplier,
      items: priced.map((p) => ({ name: p.name, adjustedCost: p.adjustedCost })),
      totalCost,
    };
  });

  const selectedCart =
    storesCarts.find((s) => s.storeId === selectedStore.id) ?? storesCarts[0];

  return {
    items: selectedCart.items.map((i) => ({ name: i.name, estimatedCost: i.adjustedCost })),
    totalCost: selectedCart.totalCost,
    recipeCount: saved.length,
    storeId: selectedStore.id,
    storeName: selectedStore.name,
    stores: storesCarts,
  };
}
