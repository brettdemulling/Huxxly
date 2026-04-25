import { IngredientCanonical, ProductCanonical, StoreProvider } from '@/lib/core/canonicalModels';
import { getAdapter } from '@/lib/adapters';
import * as cache from '@/lib/cache/cacheGateway';
import { logEvent } from '@/lib/events/eventLogger';
import { getIngredientConfidence } from './confidenceEngine';

export interface InventoryResult {
  ingredient: IngredientCanonical;
  available: boolean;
  products: ProductCanonical[];
  checkedAt: string;
  confidence: number;
  requiresFallback: boolean;
}

export async function checkInventory(
  ingredients: IngredientCanonical[],
  zip: string,
  provider: StoreProvider,
  userId: string,
): Promise<InventoryResult[]> {
  const adapter = getAdapter(provider);
  const results: InventoryResult[] = [];

  for (const ingredient of ingredients) {
    const cached = await cache.getInventory(`${provider}-${zip}`, ingredient.id);

    if (cached) {
      results.push(JSON.parse(cached as string) as InventoryResult);
      continue;
    }

    const checkedAt = new Date().toISOString();

    try {
      const products = await adapter.search(ingredient, { zip });
      const validated = await adapter.validateInventory(products, zip);
      const inStock = validated.filter((p) => p.inStock);
      const { confidence, shouldFallback } = getIngredientConfidence(validated, checkedAt);

      const result: InventoryResult = {
        ingredient,
        available: inStock.length > 0,
        products: validated,
        checkedAt,
        confidence,
        requiresFallback: shouldFallback,
      };

      await cache.setInventory(`${provider}-${zip}`, ingredient.id, result, userId);
      results.push(result);
    } catch {
      results.push({
        ingredient,
        available: false,
        products: [],
        checkedAt,
        confidence: 0,
        requiresFallback: true,
      });
    }
  }

  await logEvent('inventory_checked', userId, {
    provider,
    zip,
    total: ingredients.length,
    available: results.filter((r) => r.available).length,
    avgConfidence: results.reduce((s, r) => s + r.confidence, 0) / Math.max(results.length, 1),
  });

  return results;
}

export function getCoverageRate(results: InventoryResult[]): number {
  if (!results.length) return 0;
  return results.filter((r) => r.available).length / results.length;
}
