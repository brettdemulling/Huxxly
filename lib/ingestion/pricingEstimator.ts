/**
 * Estimates recipe prices based on MealDB category and ingredient count.
 * These are calibrated to approximate real US grocery costs.
 */

const CATEGORY_BASE_PRICE: Record<string, number> = {
  Beef: 22.00,
  Chicken: 16.00,
  Dessert: 10.00,
  Goat: 20.00,
  Lamb: 24.00,
  Miscellaneous: 14.00,
  Pasta: 13.00,
  Pork: 18.00,
  Seafood: 26.00,
  Side: 8.00,
  Starter: 10.00,
  Vegan: 11.00,
  Vegetarian: 12.00,
  Breakfast: 9.00,
};

const CATEGORY_CALORIES: Record<string, number> = {
  Beef: 520,
  Chicken: 420,
  Dessert: 380,
  Goat: 480,
  Lamb: 500,
  Miscellaneous: 400,
  Pasta: 460,
  Pork: 490,
  Seafood: 350,
  Side: 200,
  Starter: 250,
  Vegan: 320,
  Vegetarian: 340,
  Breakfast: 300,
};

const CATEGORY_COOK_TIME: Record<string, number> = {
  Beef: 60,
  Chicken: 45,
  Dessert: 40,
  Goat: 90,
  Lamb: 75,
  Miscellaneous: 30,
  Pasta: 25,
  Pork: 55,
  Seafood: 30,
  Side: 20,
  Starter: 15,
  Vegan: 25,
  Vegetarian: 30,
  Breakfast: 20,
};

const CATEGORY_TAGS: Record<string, string[]> = {
  Beef: ['beef', 'hearty'],
  Chicken: ['chicken', 'high-protein'],
  Dessert: ['sweet', 'dessert'],
  Goat: ['goat', 'exotic'],
  Lamb: ['lamb', 'hearty'],
  Miscellaneous: [],
  Pasta: ['pasta', 'italian'],
  Pork: ['pork'],
  Seafood: ['seafood', 'healthy', 'omega-3'],
  Side: ['side-dish', 'quick'],
  Starter: ['starter', 'light'],
  Vegan: ['vegan', 'plant-based', 'healthy'],
  Vegetarian: ['vegetarian', 'healthy'],
  Breakfast: ['breakfast', 'morning'],
};

export function estimatePrice(category: string, ingredientCount: number): number {
  const base = CATEGORY_BASE_PRICE[category] ?? 15.00;
  const ingredientSurcharge = Math.max(0, ingredientCount - 8) * 0.5;
  const jitter = (Math.random() - 0.5) * 2;
  return parseFloat(Math.max(5, base + ingredientSurcharge + jitter).toFixed(2));
}

export function estimateCalories(category: string): number {
  return CATEGORY_CALORIES[category] ?? 400;
}

export function estimateCookTime(category: string): number {
  return CATEGORY_COOK_TIME[category] ?? 35;
}

export function categoryTags(category: string): string[] {
  return CATEGORY_TAGS[category] ?? [];
}

export function inferDietaryTags(
  ingredientNames: string[],
  category: string,
): string[] {
  const names = ingredientNames.map((n) => n.toLowerCase());
  const tags: string[] = [...categoryTags(category)];

  const hasMeat = names.some((n) =>
    /\b(beef|chicken|pork|lamb|bacon|sausage|ham|veal|turkey|goat|duck|rabbit|venison|mutton)\b/.test(n),
  );
  const hasFish = names.some((n) =>
    /\b(salmon|tuna|cod|shrimp|prawn|crab|lobster|fish|anchov|squid|mussel|clam|oyster)\b/.test(n),
  );
  const hasDairy = names.some((n) =>
    /\b(milk|cream|butter|cheese|yogurt|yoghurt|ghee|cheddar|parmesan|mozzarella)\b/.test(n),
  );
  const hasGluten = names.some((n) =>
    /\b(flour|bread|pasta|wheat|barley|rye|soy sauce|panko|breadcrumb)\b/.test(n),
  );
  const hasEgg = names.some((n) => /\begg/.test(n));

  if (!hasMeat && !hasFish && !hasDairy && !hasEgg) tags.push('vegan');
  else if (!hasMeat && !hasFish) tags.push('vegetarian');

  if (!hasGluten) tags.push('gluten-free');
  if (!hasDairy) tags.push('dairy-free');

  return [...new Set(tags)];
}
