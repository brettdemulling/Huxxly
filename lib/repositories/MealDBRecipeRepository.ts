/**
 * MealDB Recipe Repository — upserts normalized MealDB meals into Postgres.
 * Returns minimal DB record (id + fields needed to build RecipeSearchResult).
 * No imports from searchEngine.ts — avoids circular dependency.
 */
import { prisma } from '@/lib/db';
import type { NormalizedMealDBRecipe } from '@/lib/providers/mealdb/normalizeMealDBRecipe';

export interface UpsertedRecipe {
  id: string;
  name: string;
  price: number;
  category: string;
  tags: string[];
  imageUrl: string | null;
  servings: number | null;
  cookTimeMinutes: number | null;
  cuisine: string | null;
  calories: number | null;
  description: string | null;
}

export async function upsertMealDBRecipe(n: NormalizedMealDBRecipe): Promise<UpsertedRecipe> {
  console.log(`[UPSERT_RECIPE] ${n.externalId} — "${n.name}"`);

  const recipe = await prisma.recipe.upsert({
    where: { externalId: n.externalId },
    create: {
      externalId: n.externalId,
      name: n.name,
      price: n.price,
      category: n.category,
      tags: n.tags,
      imageUrl: n.imageUrl,
      servings: n.servings,
      cuisine: n.cuisine,
      cookTimeMinutes: n.cookTimeMinutes,
      calories: n.calories,
      description: n.instructionSteps[0]?.slice(0, 200) ?? null,
    },
    update: {
      name: n.name,
      imageUrl: n.imageUrl,
      tags: n.tags,
      cuisine: n.cuisine,
      cookTimeMinutes: n.cookTimeMinutes,
      calories: n.calories,
      description: n.instructionSteps[0]?.slice(0, 200) ?? null,
    },
  });

  // Upsert ingredients (delete + recreate for simplicity)
  await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
  if (n.ingredients.length > 0) {
    await prisma.recipeIngredient.createMany({
      data: n.ingredients.map((ing) => ({
        recipeId: recipe.id,
        name: ing.name,
        measure: ing.measure || null,
        normalized: ing.name.toLowerCase().trim(),
      })),
    });
  }

  // Upsert instructions
  await prisma.recipeInstruction.deleteMany({ where: { recipeId: recipe.id } });
  if (n.instructionSteps.length > 0) {
    await prisma.recipeInstruction.createMany({
      data: n.instructionSteps.map((text, idx) => ({
        recipeId: recipe.id,
        step: idx + 1,
        text,
      })),
    });
  }

  return {
    id: recipe.id,
    name: recipe.name,
    price: recipe.price,
    category: recipe.category,
    tags: recipe.tags,
    imageUrl: recipe.imageUrl,
    servings: recipe.servings,
    cookTimeMinutes: recipe.cookTimeMinutes,
    cuisine: recipe.cuisine,
    calories: recipe.calories,
    description: recipe.description,
  };
}

export async function batchUpsertMealDB(
  recipes: NormalizedMealDBRecipe[],
): Promise<UpsertedRecipe[]> {
  const results = await Promise.allSettled(recipes.map(upsertMealDBRecipe));
  const succeeded: UpsertedRecipe[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') succeeded.push(r.value);
    else console.error('[UPSERT_RECIPE] Failed:', r.reason);
  }
  return succeeded;
}
