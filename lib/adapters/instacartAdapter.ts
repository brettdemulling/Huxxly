import { v4 as uuidv4 } from 'uuid';
import { StoreAdapter, SearchOptions } from './types';
import { IngredientCanonical, ProductCanonical, CartCanonical, CartItem } from '@/lib/core/canonicalModels';
import * as cache from '@/lib/cache/cacheGateway';

export class InstacartAdapter implements StoreAdapter {
  readonly provider = 'instacart' as const;

  async search(ingredient: IngredientCanonical, options: SearchOptions): Promise<ProductCanonical[]> {
    const cached = await cache.getProductSearch(options.zip, ingredient.normalizedName);
    if (cached) {
      return JSON.parse(cached as string) as ProductCanonical[];
    }

    // MVP: structured mock data — replace with Instacart Connect API when live
    const products = this.mockSearch(ingredient, options);
    await cache.setProductSearch(options.zip, ingredient.normalizedName, products);
    return products;
  }

  async validateInventory(products: ProductCanonical[], zip: string): Promise<ProductCanonical[]> {
    // In production: POST /v1/retailers/{retailer_id}/products/availability
    return products.map((p) => ({
      ...p,
      inStock: Math.random() > 0.08, // 92% availability simulation
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
    const deliveryFee = subtotal > 3500 ? 0 : 399;

    return {
      id: uuidv4(),
      userId,
      provider: 'instacart',
      storeId,
      storeName: 'Kroger (via Instacart)',
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
    // In production: POST /v1/carts to get Instacart cart URL
    const checkoutUrl = `https://www.instacart.com/store/kroger/checkout?cart_id=${cart.id}`;
    return { checkoutUrl, cartId: cart.id };
  }

  private mockSearch(ingredient: IngredientCanonical, options: SearchOptions): ProductCanonical[] {
    return [
      {
        id: uuidv4(),
        storeId: `instacart-${options.zip}-001`,
        provider: 'instacart',
        name: `${ingredient.name} (Store Brand)`,
        brand: 'Simple Truth',
        priceCents: Math.max(99, ingredient.estimatedCostCents - 50),
        unit: ingredient.unit,
        quantity: ingredient.quantity,
        inStock: true,
        availableInZip: options.zip,
        matchScore: 0.92,
        ingredientId: ingredient.id,
      },
      {
        id: uuidv4(),
        storeId: `instacart-${options.zip}-001`,
        provider: 'instacart',
        name: `${ingredient.name} (Name Brand)`,
        brand: 'National Brand',
        priceCents: ingredient.estimatedCostCents + 80,
        unit: ingredient.unit,
        quantity: ingredient.quantity,
        inStock: true,
        availableInZip: options.zip,
        matchScore: 0.88,
        ingredientId: ingredient.id,
      },
    ];
  }
}
