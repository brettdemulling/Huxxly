import type { MealCanonical, IngredientCanonical, CartCanonical, CartItem } from '@/lib/core/canonicalModels';
import { v4 as uuidv4 } from 'uuid';

export interface MealBundle {
  name: string;
  description: string;
  meals: MealCanonical[];
  totalCostCents: number;
  sharedIngredientCount: number;
  dietaryFlags: string[];
}

export interface RecipeToCartMapping {
  meal: MealCanonical;
  cartItems: CartItem[];
  unmappedIngredients: string[];
  coverageRatio: number;
}

// ─── Bundle builders ──────────────────────────────────────────────────────────

export function buildFamilyBundle(
  meals: MealCanonical[],
  targetBudgetCents: number,
): MealBundle {
  const selected = selectWithinBudget(meals, targetBudgetCents);
  return assemblBundle('Family Meal Plan', 'Balanced meals for the whole week.', selected);
}

export function buildQuickBundle(meals: MealCanonical[]): MealBundle {
  const quick = meals
    .filter((m) => m.prepTimeMinutes + m.cookTimeMinutes <= 30)
    .slice(0, 5);
  return assemblBundle('Quick Meals', 'Ready in 30 minutes or less.', quick);
}

export function buildDietaryBundle(
  meals: MealCanonical[],
  flags: string[],
): MealBundle {
  if (!flags.length) return buildFamilyBundle(meals, Infinity);
  const filtered = meals.filter((m) =>
    flags.every((f) => m.dietaryFlags.includes(f)),
  );
  const label = flags.map((f) => f.replace('_', '-')).join(', ');
  return assemblBundle(
    `${label.charAt(0).toUpperCase() + label.slice(1)} Plan`,
    `Meals aligned with your preferences.`,
    filtered.slice(0, 5),
  );
}

// ─── Recipe → cart mapping ────────────────────────────────────────────────────

export function mapRecipeToCart(
  meal: MealCanonical,
  availableItems: CartItem[],
): RecipeToCartMapping {
  const matched: CartItem[] = [];
  const unmapped: string[] = [];

  for (const ingredient of meal.ingredients) {
    const hit = findBestMatch(ingredient, availableItems);
    if (hit) {
      matched.push(hit);
    } else {
      unmapped.push(ingredient.name);
    }
  }

  const coverageRatio =
    meal.ingredients.length > 0
      ? matched.length / meal.ingredients.length
      : 0;

  return { meal, cartItems: matched, unmappedIngredients: unmapped, coverageRatio };
}

export function mapBundleToCart(
  bundle: MealBundle,
  cart: CartCanonical,
): RecipeToCartMapping[] {
  return bundle.meals.map((meal) => mapRecipeToCart(meal, cart.items));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function selectWithinBudget(
  meals: MealCanonical[],
  budgetCents: number,
): MealCanonical[] {
  const sorted = [...meals].sort((a, b) => a.estimatedCostCents - b.estimatedCostCents);
  const selected: MealCanonical[] = [];
  let running = 0;
  for (const meal of sorted) {
    if (running + meal.estimatedCostCents <= budgetCents) {
      selected.push(meal);
      running += meal.estimatedCostCents;
    }
    if (selected.length >= 5) break;
  }
  return selected;
}

function assemblBundle(name: string, description: string, meals: MealCanonical[]): MealBundle {
  const allFlags = meals.flatMap((m) => m.dietaryFlags);
  const sharedFlags = allFlags.filter((f) => allFlags.filter((x) => x === f).length > 1);

  const ingredientNames = meals.flatMap((m) => m.ingredients.map((i) => i.normalizedName));
  const sharedIngredientCount = ingredientNames.filter(
    (n, _i, arr) => arr.filter((x) => x === n).length > 1,
  ).length;

  return {
    name,
    description,
    meals,
    totalCostCents: meals.reduce((s, m) => s + m.estimatedCostCents, 0),
    sharedIngredientCount: new Set(ingredientNames.filter(
      (n, _i, arr) => arr.filter((x) => x === n).length > 1,
    )).size,
    dietaryFlags: [...new Set(sharedFlags)],
  };
}

function findBestMatch(
  ingredient: IngredientCanonical,
  items: CartItem[],
): CartItem | null {
  const needle = ingredient.normalizedName.toLowerCase();
  return (
    items.find((item) => item.product.name.toLowerCase().includes(needle)) ??
    items.find((item) =>
      needle.split(' ').some((word) => item.product.name.toLowerCase().includes(word)),
    ) ??
    null
  );
}
