export const SERVING_OPTIONS = [1, 2, 4, 6, 8] as const;
export type ServingCount = (typeof SERVING_OPTIONS)[number];

export interface ServingAdjustedRecipe {
  id: string;
  title: string;
  price: number;
  adjustedPrice: number;
  servings: number;
  displayServings: number;
  costPerServing: number;
}

export function adjustForServings<T extends { price: number; servings?: number }>(
  recipe: T,
  baseServings: number,
  targetServings: number,
): T & { adjustedPrice: number; displayServings: number; costPerServing: number } {
  const base = baseServings > 0 ? baseServings : 4;
  const adjusted = parseFloat(((recipe.price / base) * targetServings).toFixed(2));
  return {
    ...recipe,
    adjustedPrice: adjusted,
    displayServings: targetServings,
    costPerServing: parseFloat((adjusted / targetServings).toFixed(2)),
  };
}

export function costPerServing(totalCost: number, servings: number): number {
  if (servings <= 0) return totalCost;
  return parseFloat((totalCost / servings).toFixed(2));
}
