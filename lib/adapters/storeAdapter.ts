import { CartCanonical, IngredientCanonical, StoreProvider } from '@/lib/core/canonicalModels';
import { getAdapter } from '@/lib/adapters';

export interface StoreAdapter {
  searchProducts(query: string, zip: string): Promise<unknown>;
  buildCart(items: IngredientCanonical[], userId: string, storeId: string): Promise<CartCanonical>;
  generateCheckoutLink(cart: CartCanonical): Promise<string>;
}

export function getStoreAdapter(provider: StoreProvider): StoreAdapter {
  const inner = getAdapter(provider);
  return {
    async searchProducts(query, zip) {
      const fakeIngredient: IngredientCanonical = {
        id: 'search',
        name: query,
        normalizedName: query.toLowerCase().replace(/\s+/g, '_'),
        category: 'other',
        quantity: 1,
        unit: 'item',
        estimatedCostCents: 200,
        dietaryFlags: [],
        substitutes: [],
      };
      return inner.search(fakeIngredient, { zip });
    },

    async buildCart(items, userId, storeId) {
      const products = await Promise.all(
        items.map((ing) =>
          inner.search(ing, { zip: '00000' }).then((ps) => ps[0]).catch(() => null),
        ),
      );
      const valid = products.filter(Boolean) as Awaited<ReturnType<typeof inner.search>>[number][];
      return inner.buildCart(valid, userId, storeId);
    },

    async generateCheckoutLink(cart) {
      const { checkoutUrl } = await inner.checkout(cart);
      return checkoutUrl;
    },
  };
}
