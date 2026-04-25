import { IngredientCanonical, ProductCanonical } from '@/lib/core/canonicalModels';
import { getAdapter } from '@/lib/adapters';
import { StoreProvider } from '@/lib/core/canonicalModels';

// Category-level substitution rules
const SUBSTITUTION_MAP: Record<string, string[]> = {
  protein: ['chicken breast', 'ground turkey', 'canned tuna', 'eggs', 'tofu', 'lentils'],
  dairy: ['almond milk', 'oat milk', 'coconut milk', 'cashew cheese'],
  grain: ['brown rice', 'quinoa', 'oat flour', 'whole wheat pasta', 'cauliflower rice'],
  oil: ['olive oil', 'avocado oil', 'coconut oil', 'vegetable oil'],
  sweetener: ['honey', 'maple syrup', 'coconut sugar', 'stevia'],
  vegetable: ['frozen mixed vegetables', 'spinach', 'kale', 'broccoli', 'zucchini'],
};

export interface SubstitutionResult {
  originalIngredient: IngredientCanonical;
  substituteName: string;
  substituteProduct: ProductCanonical | null;
  reason: string;
}

export async function findSubstitute(
  ingredient: IngredientCanonical,
  provider: StoreProvider,
  zip: string,
  rejectedSubs: string[] = [],
): Promise<SubstitutionResult | null> {
  // Try explicit substitute list from ingredient first
  const candidates = [
    ...ingredient.substitutes,
    ...(SUBSTITUTION_MAP[ingredient.category.toLowerCase()] ?? []),
  ].filter((s) => !rejectedSubs.includes(s));

  const adapter = getAdapter(provider);

  for (const candidate of candidates.slice(0, 3)) {
    try {
      const subIngredient: IngredientCanonical = {
        ...ingredient,
        name: candidate,
        normalizedName: candidate.toLowerCase().replace(/\s+/g, '_'),
      };

      const products = await adapter.search(subIngredient, { zip });
      const inStock = products.filter((p) => p.inStock);

      if (inStock.length > 0) {
        const cheapest = inStock.sort((a, b) => a.priceCents - b.priceCents)[0];
        return {
          originalIngredient: ingredient,
          substituteName: candidate,
          substituteProduct: cheapest,
          reason: `${ingredient.name} unavailable — substituted with closest ${ingredient.category} alternative`,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function resolveUnavailableItems(
  unavailableIngredients: IngredientCanonical[],
  provider: StoreProvider,
  zip: string,
  rejectedSubs: string[] = [],
): Promise<SubstitutionResult[]> {
  const results: SubstitutionResult[] = [];

  for (const ingredient of unavailableIngredients) {
    const sub = await findSubstitute(ingredient, provider, zip, rejectedSubs);
    if (sub) results.push(sub);
  }

  return results;
}
