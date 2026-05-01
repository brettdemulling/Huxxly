import { prisma } from '@/lib/db';
import { resolveStores, resolveStore } from '@/lib/domains/stores';
import { applyPricing, sumTotal } from '@/lib/domains/pricing';

export interface CartItem {
  name: string;
  estimatedCost: number;
}

export interface StoreCart {
  storeId: string;
  storeName: string;
  priceMultiplier: number;
  items: { name: string; adjustedCost: number }[];
  totalCost: number;
}

export interface CartResult {
  items: CartItem[];
  totalCost: number;
  recipeCount: number;
  storeId?: string;
  storeName?: string;
  stores?: StoreCart[];
}

export async function runCart(
  userId: string,
  zipCode?: string,
  storeId?: string,
): Promise<CartResult> {
  const saved = await prisma.savedRecipe.findMany({
    where: { userId },
    include: { recipe: true },
  });

  if (!saved.length) {
    return { items: [], totalCost: 0, recipeCount: 0 };
  }

  const baseItems = saved.map((s) => ({ name: s.recipe.name, price: s.recipe.price }));

  if (!zipCode) {
    const items: CartItem[] = baseItems.map((i) => ({ name: i.name, estimatedCost: i.price }));
    const totalCost = sumTotal(items.map((i) => ({ adjustedCost: i.estimatedCost })));
    return { items, totalCost, recipeCount: saved.length };
  }

  const stores = resolveStores(zipCode);
  const selectedStore = resolveStore(zipCode, storeId);

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
