/**
 * Normalizes raw MealDB API meals into the internal RecipeEntity shape.
 * Every required field is guaranteed non-null.
 */
import type { MealDBDetail } from '@/lib/ingestion/mealDBClient';
import { extractIngredients } from '@/lib/ingestion/mealDBClient';
import {
  estimatePrice,
  estimateCalories,
  estimateCookTime,
  inferDietaryTags,
} from '@/lib/ingestion/pricingEstimator';

export interface NormalizedMealDBRecipe {
  externalId: string;           // "mealdb-{idMeal}"
  name: string;
  imageUrl: string;             // always present from MealDB
  ingredients: { name: string; measure: string }[];
  instructionSteps: string[];
  category: string;             // lowercase for DB storage
  rawCategory: string;          // original case for pricing lookup tables
  cuisine: string;
  tags: string[];
  cookTimeMinutes: number;
  servings: number;
  price: number;
  calories: number;
}

export function normalizeMealDBRecipe(meal: MealDBDetail): NormalizedMealDBRecipe {
  const rawCategory = meal.strCategory ?? 'Miscellaneous';
  const ingredients = extractIngredients(meal);
  const ingredientNames = ingredients.map((i) => i.name);
  const tags = inferDietaryTags(ingredientNames, rawCategory);

  const instructionSteps = (meal.strInstructions ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10)
    .slice(0, 20);

  console.log(`[MEALDB_NORMALIZE] "${meal.strMeal}" → ${tags.length} tags, ${ingredients.length} ingredients`);

  return {
    externalId: `mealdb-${meal.idMeal}`,
    name: meal.strMeal,
    imageUrl: meal.strMealThumb,
    ingredients,
    instructionSteps,
    category: rawCategory.toLowerCase(),
    rawCategory,
    cuisine: meal.strArea && meal.strArea !== 'Unknown' ? meal.strArea : 'International',
    tags,
    cookTimeMinutes: estimateCookTime(rawCategory),
    servings: 4,
    price: estimatePrice(rawCategory, ingredients.length),
    calories: estimateCalories(rawCategory),
  };
}

export function normalizeManyMealDBRecipes(meals: MealDBDetail[]): NormalizedMealDBRecipe[] {
  return meals.map(normalizeMealDBRecipe);
}
