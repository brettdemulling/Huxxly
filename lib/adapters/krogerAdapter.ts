import { v4 as uuidv4 } from 'uuid';
import { StoreAdapter, SearchOptions } from './types';
import { IngredientCanonical, ProductCanonical, CartCanonical, CartItem } from '@/lib/core/canonicalModels';
import * as cache from '@/lib/cache/cacheGateway';

export class KrogerAdapter implements StoreAdapter {
  readonly provider = 'kroger' as const;

  async search(ingredient: IngredientCanonical, options: SearchOptions): Promise<ProductCanonical[]> {
    const cacheKey = `kroger:${ingredient.normalizedName}`;
    const cached = await cache.getProductSearch(options.zip, cacheKey);
    if (cached) {
      return JSON.parse(cached as string) as ProductCanonical[];
    }

    // In production: Kroger API /v1/products?filter.term=X&filter.locationId=X
    const products = this.mockSearch(ingredient, options);
    await cache.setProductSearch(options.zip, cacheKey, products);
    return products;
  }

  async validateInventory(products: ProductCanonical[], zip: string): Promise<ProductCanonical[]> {
    // In production: /v1/products?filter.fulfillment=ais per location
    return products.map((p) => ({
      ...p,
      inStock: Math.random() > 0.1,
      availableInZip: zip,
    }));
  }

  async buildCart(products: ProductCanonical[], userId: string, storeId: string): Promise<CartCanonical> {
    const items: CartItem[] = products
      .filter((p) => p.inStock)
      .map((p) => ({
        product: p,
        ingredientId: p.ingredientId ?? '',
        quantity: 1,
        lineTotal: p.priceCents,
      }));

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const deliveryFee = subtotal > 3500 ? 0 : 499;

    return {
      id: uuidv4(),
      userId,
      provider: 'kroger',
      storeId,
      storeName: 'Kroger',
      items,
      subtotalCents: subtotal,
      estimatedDeliveryFee: deliveryFee,
      estimatedTotalCents: subtotal + deliveryFee,
      missingIngredients: products.filter((p) => !p.inStock).map((p) => p.name),
      coverageScore: items.length / Math.max(products.length, 1),
      createdAt: new Date().toISOString(),
    };
  }

  async checkout(cart: CartCanonical): Promise<{ checkoutUrl: string; cartId: string }> {
    const checkoutUrl = `https://www.kroger.com/checkout?source=autopilot&cart=${cart.id}`;
    return { checkoutUrl, cartId: cart.id };
  }

  private mockSearch(ingredient: IngredientCanonical, options: SearchOptions): ProductCanonical[] {
    return [
      {
        id: uuidv4(),
        storeId: `kroger-${options.zip}-001`,
        provider: 'kroger',
        name: `Kroger ${ingredient.name}`,
        brand: 'Kroger',
        priceCents: Math.max(99, ingredient.estimatedCostCents - 30),
        unit: ingredient.unit,
        quantity: ingredient.quantity,
        inStock: true,
        availableInZip: options.zip,
        matchScore: 0.9,
        ingredientId: ingredient.id,
      },
    ];
  }
}
