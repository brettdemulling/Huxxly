import { IngredientCanonical, ProductCanonical, CartCanonical, StoreProvider } from '@/lib/core/canonicalModels';

export interface SearchOptions {
  zip: string;
  maxResults?: number;
  maxPriceCents?: number;
}

export interface StoreAdapter {
  readonly provider: StoreProvider;
  search(ingredient: IngredientCanonical, options: SearchOptions): Promise<ProductCanonical[]>;
  validateInventory(products: ProductCanonical[], zip: string): Promise<ProductCanonical[]>;
  buildCart(products: ProductCanonical[], userId: string, storeId: string): Promise<CartCanonical>;
  checkout(cart: CartCanonical): Promise<{ checkoutUrl: string; cartId: string }>;
}
