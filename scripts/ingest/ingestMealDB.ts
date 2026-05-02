/**
 * TheMealDB ingestion script.
 *
 * Fetches all categories → all meals → full meal details and upserts into
 * the recipes table using externalId as the stable key. Safe to re-run.
 *
 * Usage:
 *   node_modules/.bin/jiti scripts/ingest/ingestMealDB.ts
 *
 * Or add to package.json:
 *   "ingest:mealdb": "jiti scripts/ingest/ingestMealDB.ts"
 */

import { PrismaClient } from '@prisma/client';
import {
  fetchCategories,
  fetchMealsByCategory,
  fetchMealDetail,
  extractIngredients,
  parseInstructions,
  sleep,
} from '../../lib/ingestion/mealDBClient';
import {
  estimatePrice,
  estimateCalories,
  estimateCookTime,
  inferDietaryTags,
} from '../../lib/ingestion/pricingEstimator';

const prisma = new PrismaClient();

// ─── Config ───────────────────────────────────────────────────────────────────

const RATE_LIMIT_MS = 200;  // be polite to the free API
const MAX_PER_CATEGORY = 30; // cap per category so we don't ingest 300+ all at once on first run
const SKIP_CATEGORIES = new Set(['Unknown']);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[ingest] Starting TheMealDB ingestion...');

  const categories = await fetchCategories();
  console.log(`[ingest] Found ${categories.length} categories`);

  let totalUpserted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const cat of categories) {
    if (SKIP_CATEGORIES.has(cat.strCategory)) continue;
    console.log(`[ingest] Processing category: ${cat.strCategory}`);

    const summaries = await fetchMealsByCategory(cat.strCategory);
    const batch = summaries.slice(0, MAX_PER_CATEGORY);

    for (const summary of batch) {
      const externalId = `mealdb-${summary.idMeal}`;

      try {
        await sleep(RATE_LIMIT_MS);
        const detail = await fetchMealDetail(summary.idMeal);
        if (!detail) { totalSkipped++; continue; }

        const ingredients = extractIngredients(detail);
        const ingredientNames = ingredients.map((i) => i.name);
        const tags = inferDietaryTags(ingredientNames, cat.strCategory);
        const price = estimatePrice(cat.strCategory, ingredients.length);
        const calories = estimateCalories(cat.strCategory);
        const cookTimeMinutes = estimateCookTime(cat.strCategory);
        const instructions = parseInstructions(detail.strInstructions ?? '');

        // Upsert the recipe
        const recipe = await prisma.recipe.upsert({
          where: { externalId },
          create: {
            externalId,
            name: detail.strMeal,
            price,
            category: cat.strCategory.toLowerCase(),
            tags,
            imageUrl: detail.strMealThumb ?? null,
            servings: 4,
            description: instructions[0]?.slice(0, 200) ?? null,
            cuisine: detail.strArea ?? null,
            cookTimeMinutes,
            calories,
            sourceUrl: detail.strSource ?? detail.strYoutube ?? null,
          },
          update: {
            name: detail.strMeal,
            imageUrl: detail.strMealThumb ?? null,
            tags,
            cuisine: detail.strArea ?? null,
            cookTimeMinutes,
            calories,
            description: instructions[0]?.slice(0, 200) ?? null,
            sourceUrl: detail.strSource ?? detail.strYoutube ?? null,
          },
        });

        // Upsert ingredients — delete existing first, then recreate
        await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
        if (ingredients.length > 0) {
          await prisma.recipeIngredient.createMany({
            data: ingredients.map((ing) => ({
              recipeId: recipe.id,
              name: ing.name,
              measure: ing.measure || null,
              normalized: ing.name.toLowerCase().trim(),
            })),
          });
        }

        // Upsert instructions — delete existing first, then recreate
        await prisma.recipeInstruction.deleteMany({ where: { recipeId: recipe.id } });
        if (instructions.length > 0) {
          await prisma.recipeInstruction.createMany({
            data: instructions.map((text, idx) => ({
              recipeId: recipe.id,
              step: idx + 1,
              text,
            })),
          });
        }

        totalUpserted++;
        if (totalUpserted % 20 === 0) {
          console.log(`[ingest] Progress: ${totalUpserted} upserted, ${totalFailed} failed`);
        }
      } catch (err) {
        console.error(`[ingest] Failed ${externalId}:`, err instanceof Error ? err.message : err);
        totalFailed++;
      }
    }
  }

  console.log(`[ingest] Done. Upserted: ${totalUpserted}, Skipped: ${totalSkipped}, Failed: ${totalFailed}`);
}

main()
  .catch((err) => { console.error('[ingest] Fatal:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
