import { IngredientCanonical, ProductCanonical } from '@/lib/core/canonicalModels';

interface ScoredProduct extends ProductCanonical {
  finalScore: number;
}

// Score = 0.4 match + 0.3 price + 0.2 availability + 0.1 preference
function scoreProduct(
  product: ProductCanonical,
  ingredient: IngredientCanonical,
  budgetCents: number,
  preferredBrands: string[] = [],
): number {
  const matchScore = product.matchScore ?? 0;

  const maxPriceCents = ingredient.estimatedCostCents * 2;
  const priceScore = product.priceCents <= maxPriceCents
    ? 1 - product.priceCents / maxPriceCents
    : 0;

  const availScore = product.inStock ? 1 : 0;

  const brand = product.brand?.toLowerCase() ?? '';
  const prefScore = preferredBrands.some((b) => brand.includes(b.toLowerCase())) ? 1 : 0;

  return 0.4 * matchScore + 0.3 * priceScore + 0.2 * availScore + 0.1 * prefScore;
}

export function selectBestProduct(
  products: ProductCanonical[],
  ingredient: IngredientCanonical,
  budgetCents: number,
  preferredBrands: string[] = [],
): ProductCanonical | null {
  if (!products.length) return null;

  const scored: ScoredProduct[] = products
    .filter((p) => p.inStock)
    .map((p) => ({
      ...p,
      finalScore: scoreProduct(p, ingredient, budgetCents, preferredBrands),
    }))
    .sort((a, b) => b.finalScore - a.finalScore);

  return scored[0] ?? null;
}

export function selectBestProducts(
  inventoryResults: Array<{ ingredient: IngredientCanonical; products: ProductCanonical[] }>,
  budgetCents: number,
  preferredBrands: string[] = [],
): Map<string, ProductCanonical> {
  const selected = new Map<string, ProductCanonical>();

  for (const { ingredient, products } of inventoryResults) {
    const best = selectBestProduct(products, ingredient, budgetCents, preferredBrands);
    if (best) selected.set(ingredient.id, best);
  }

  return selected;
}
