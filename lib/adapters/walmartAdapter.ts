import { v4 as uuidv4 } from 'uuid';
import { StoreAdapter, SearchOptions } from './types';
import { IngredientCanonical, ProductCanonical, CartCanonical, CartItem } from '@/lib/core/canonicalModels';
import * as cache from '@/lib/cache/cacheGateway';

export class WalmartAdapter implements StoreAdapter {
  readonly provider = 'walmart' as const;

  async search(ingredient: IngredientCanonical, options: SearchOptions): Promise<ProductCanonical[]> {
    const cacheKey = `walmart:${ingredient.normalizedName}`;
    const cached = await cache.getProductSearch(options.zip, cacheKey);
    if (cached) {
      return JSON.parse(cached as string) as ProductCanonical[];
    }

    const products = this.mockSearch(ingredient, options);
    await cache.setProductSearch(options.zip, cacheKey, products);
    return products;
  }

  async validateInventory(products: ProductCanonical[], zip: string): Promise<ProductCanonical[]> {
    return products.map((p) => ({
      ...p,
      inStock: Math.random() > 0.05,
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
    const deliveryFee = subtotal > 3500 ? 0 : 798;

    return {
      id: uuidv4(),
      userId,
      provider: 'walmart',
      storeId,
      storeName: 'Walmart Supercenter',
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
    const itemQuery = cart.items
      .map((i) => encodeURIComponent(i.product.name))
      .slice(0, 5)
      .join('+');
    const checkoutUrl = `https://www.walmart.com/search?q=${itemQuery}&fulfillment=delivery`;
    return { checkoutUrl, cartId: cart.id };
  }

  private mockSearch(ingredient: IngredientCanonical, options: SearchOptions): ProductCanonical[] {
    return [
      {
        id: uuidv4(),
        storeId: `walmart-${options.zip}-001`,
        provider: 'walmart',
        name: `Great Value ${ingredient.name}`,
        brand: 'Great Value',
        priceCents: Math.max(79, ingredient.estimatedCostCents - 80),
        unit: ingredient.unit,
        quantity: ingredient.quantity,
        inStock: true,
        availableInZip: options.zip,
        matchScore: 0.85,
        ingredientId: ingredient.id,
      },
      {
        id: uuidv4(),
        storeId: `walmart-${options.zip}-001`,
        provider: 'walmart',
        name: ingredient.name,
        priceCents: ingredient.estimatedCostCents,
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
