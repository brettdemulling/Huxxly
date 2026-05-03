import { prisma } from '@/lib/db';
import { generateRecipesFromIntent } from '@/lib/ai/generateRecipes';
import { generateFallbackRecipes } from '@/lib/ai/generateFallbackRecipes';
import { shapeResults } from '@/lib/search/resultShaper';
import { rankResults, scoreResult } from '@/lib/search/ranking';
import { searchRecipes as searchMealDB } from '@/lib/providers/mealdb/MealDBProvider';
import { normalizeManyMealDBRecipes } from '@/lib/providers/mealdb/normalizeMealDBRecipe';
import { batchUpsertMealDB } from '@/lib/repositories/MealDBRecipeRepository';

// Call MealDB when DB has fewer than this many results for a non-empty query
const MEALDB_THRESHOLD = 8;
// Call AI when even after MealDB enrichment we're still sparse
const AI_THRESHOLD = 5;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SearchMeta {
  servings: number | null;
  budgetTotal: number | null;
  estimatedTotal: number;
  isServingQuery: boolean;
  isBudgeted: boolean;
  dietTags: string[];
  intentFlags: string[];
  dbCount: number;
  mealdbCount: number;
  aiCount: number;
  realApiCount: number;
  fallbackUsed: boolean;
  totalCount: number;
}

export interface SearchResponse {
  results: RecipeSearchResult[];
  meta: SearchMeta;
}

export interface RecipeSearchResult {
  id: string;
  type: 'meal';
  title: string;
  price: number;
  adjustedPrice: number;
  description: string;
  score: number;
  imageUrl?: string;
  servings?: number;
  displayServings?: number;
  category: string;
  tags: string[];
  cookTimeMinutes?: number;
  cuisine?: string;
  calories?: number;
  source?: 'db' | 'ai' | 'fallback';
}

// ─── Parsed intent ────────────────────────────────────────────────────────────

interface ParsedIntent {
  servings?: number;
  budgetTotal?: number;
  dietTags: string[];
  intentFlags: string[];
  ingredients: string[];
  rawTokens: string[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'for', 'the', 'and', 'or', 'a', 'an', 'in', 'on', 'at', 'of', 'with',
  'my', 'me', 'i', 'we', 'is', 'are', 'be', 'to', 'do', 'it', 'that',
  'under', 'over', 'make', 'cook', 'need', 'want', 'some', 'meal', 'meals',
  'dinner', 'lunch', 'breakfast', 'recipe', 'recipes', 'food', 'eat',
]);

const DIET_PATTERNS: [RegExp, string][] = [
  [/\bvegan\b/, 'vegan'],
  [/\bvegetarian\b/, 'vegetarian'],
  [/\bketo\b/, 'keto'],
  [/\bgluten[\s-]?free\b/, 'gluten-free'],
  [/\blow[\s-]?carb\b/, 'low-carb'],
  [/\bdairy[\s-]?free\b/, 'dairy-free'],
  [/\bpaleo\b/, 'paleo'],
  [/\bhigh[\s-]?protein\b/, 'high-protein'],
  [/\blow[\s-]?fat\b/, 'low-fat'],
  [/\bnut[\s-]?free\b/, 'nut-free'],
];

const INTENT_PATTERNS: [RegExp, string][] = [
  [/\b(?:cheap|budget|affordable|inexpensive|economical|frugal|low[\s-]cost)\b/, 'cheap'],
  [/\b(?:quick|fast|easy|simple|rapid|30[\s-]?min(?:ute)?s?|weeknight)\b/, 'quick'],
  [/\b(?:high[\s-]?protein|protein[\s-]?rich|protein[\s-]?packed|muscle|gains?)\b/, 'high-protein'],
  [/\b(?:meal[\s-]?prep|prep|batch[\s-]?cook|batch)\b/, 'meal-prep'],
  [/\b(?:healthy|light|clean|nutritious|wholesome|fresh)\b/, 'healthy'],
  [/\b(?:comfort|hearty|filling|cozy|warming|rich)\b/, 'comfort'],
  [/\b(?:family|kid[\s-]?friendly|kids?|children|toddler)\b/, 'family'],
  [/\b(?:fancy|gourmet|special|date[\s-]?night|premium|luxur(?:y|ious))\b/, 'gourmet'],
];

const KNOWN_INGREDIENTS = [
  'chicken', 'beef', 'pork', 'lamb', 'fish', 'shrimp', 'salmon', 'tuna',
  'turkey', 'bacon', 'sausage', 'steak', 'ribs',
  'pasta', 'rice', 'noodle', 'bread', 'potato', 'quinoa',
  'tomato', 'mushroom', 'spinach', 'broccoli', 'carrot', 'onion', 'garlic',
  'tofu', 'egg', 'cheese', 'avocado', 'lemon', 'lime',
  'soy', 'miso', 'curry', 'coconut', 'ginger',
];

function parseIntent(query: string): ParsedIntent {
  const q = query.toLowerCase().trim();

  let servings: number | undefined;
  const servingMatchers: RegExp[] = [
    /\bfor\s+(\d+)\s+(?:people|persons?|servings?|adults?|guests?|kids?|of\s+us)\b/,
    /\b(\d+)\s+(?:people|persons?|servings?|adults?|guests?)\b/,
    /\bfamily\s+of\s+(\d+)\b/,
    /\b(\d+)[\s-]?person\b/,
    /\bserves?\s+(\d+)\b/,
  ];
  for (const rx of servingMatchers) {
    const m = q.match(rx);
    if (m?.[1]) { servings = Math.min(Math.max(parseInt(m[1], 10), 1), 20); break; }
  }

  let budgetTotal: number | undefined;
  const budgetMatchers: RegExp[] = [
    /under\s*\$\s*(\d+(?:\.\d+)?)/,
    /less\s+than\s*\$\s*(\d+(?:\.\d+)?)/,
    /\$\s*(\d+(?:\.\d+)?)\s*(?:budget|max|limit|or\s+less|total)?/,
    /(\d+(?:\.\d+)?)\s*(?:dollars?|bucks?)\s*(?:budget|max|limit|or\s+less|total)?/,
    /budget\s+(?:of\s+)?\$?\s*(\d+(?:\.\d+)?)/,
  ];
  for (const rx of budgetMatchers) {
    const m = q.match(rx);
    if (m?.[1]) { budgetTotal = parseFloat(m[1]); break; }
  }

  const dietTags = DIET_PATTERNS.flatMap(([rx, tag]) => (rx.test(q) ? [tag] : []));
  const intentFlags = INTENT_PATTERNS.flatMap(([rx, flag]) => (rx.test(q) ? [flag] : []));
  const ingredients = KNOWN_INGREDIENTS.filter((ing) => q.includes(ing));
  const rawTokens = q
    .split(/[\s,]+/)
    .map((w) => w.replace(/[^a-z]/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

  return { servings, budgetTotal, dietTags, intentFlags, ingredients, rawTokens };
}

// ─── Price adjustment ─────────────────────────────────────────────────────────

function calcAdjustedPrice(price: number, baseServings: number | null, targetServings?: number): number {
  if (!targetServings) return price;
  const base = baseServings ?? 4;
  if (targetServings === base) return price;
  return parseFloat(((price / base) * targetServings).toFixed(2));
}

// ─── DB query + scoring ───────────────────────────────────────────────────────

type PrismaRecipe = {
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
};

function toSearchResult(r: PrismaRecipe, ap: number, score: number, displayServings?: number): RecipeSearchResult {
  return {
    id: r.id,
    type: 'meal',
    title: r.name,
    price: r.price,
    adjustedPrice: ap,
    description: r.description ?? `${r.category} · ${r.tags.slice(0, 3).join(', ')}`,
    score,
    imageUrl: r.imageUrl ?? undefined,
    servings: r.servings ?? undefined,
    displayServings,
    category: r.category,
    tags: r.tags,
    cookTimeMinutes: r.cookTimeMinutes ?? undefined,
    cuisine: r.cuisine ?? undefined,
    calories: r.calories ?? undefined,
    source: 'db',
  };
}

async function queryAndScoreDB(intent: ParsedIntent, limit: number): Promise<RecipeSearchResult[]> {
  const allRecipes = await prisma.recipe.findMany({ orderBy: { createdAt: 'desc' } });

  const candidates = allRecipes.flatMap((r) => {
    const ap = calcAdjustedPrice(r.price, r.servings, intent.servings);

    // Budget hard constraint
    if (intent.budgetTotal !== undefined && ap > intent.budgetTotal) return [];

    // Dietary hard constraint — recipe must have ALL required tags
    if (intent.dietTags.length > 0) {
      const recipeTags = r.tags.map((t) => t.toLowerCase());
      const allPresent = intent.dietTags.every((dt) => {
        const slug = dt.replace('-', '');
        return recipeTags.some((t) => t === dt || t.replace('-', '') === slug);
      });
      if (!allPresent) return [];
    }

    // Ingredient hard constraint — at least one must match
    if (intent.ingredients.length > 0) {
      const full = `${r.name} ${r.category} ${r.tags.join(' ')}`.toLowerCase();
      if (!intent.ingredients.some((ing) => full.includes(ing))) return [];
    }

    return [{ r, ap }];
  });

  // Rank using ranking engine
  const rankCtx = {
    tokens: intent.rawTokens,
    dietTags: intent.dietTags,
    ingredients: intent.ingredients,
  };

  const hasQuery = intent.rawTokens.length > 0 || intent.dietTags.length > 0 || intent.ingredients.length > 0;

  const ranked = candidates
    .map(({ r, ap }) => ({
      result: toSearchResult(r, ap, 0, intent.servings),
      r,
    }))
    .map(({ result }) => {
      if (!hasQuery) return { ...result, score: 1 };
      return { ...result, score: scoreResult(result, rankCtx) };
    })
    .filter((r) => !hasQuery || r.score > 0)
    .sort((a, b) => b.score - a.score || a.adjustedPrice - b.adjustedPrice)
    .slice(0, limit);

  return ranked;
}

// ─── MealDB query extraction ──────────────────────────────────────────────────

function extractPrimaryIngredient(query: string, intent: ParsedIntent): string {
  if (intent.ingredients.length > 0) return intent.ingredients[0];
  const dietWords = new Set(intent.dietTags.flatMap((t) => t.split('-')));
  const intentWords = new Set(intent.intentFlags.flatMap((f) => f.split('-')));
  const foodToken = intent.rawTokens.find((t) => !dietWords.has(t) && !intentWords.has(t));
  if (foodToken) return foodToken;
  return query.trim();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function searchRecipes(query: string, limit = 20): Promise<SearchResponse> {
  const intent = parseIntent(query.trim());
  const hasQuery = query.trim().length > 0;

  console.log('[SEARCH_START]', { query, intent });

  // ── STEP 1: Query Postgres ─────────────────────────────────────────────────
  const dbResults = await queryAndScoreDB(intent, limit);
  console.log(`[SEARCH_RESULT] DB returned ${dbResults.length} results`);

  // ── STEP 2: MealDB enrichment when DB is sparse ────────────────────────────
  let mealdbResults: RecipeSearchResult[] = [];
  let mealdbCount = 0;

  if (hasQuery && dbResults.length < MEALDB_THRESHOLD) {
    console.log(`[MEALDB_FETCH] DB sparse (${dbResults.length} < ${MEALDB_THRESHOLD}), calling MealDB...`);
    try {
      const primaryIngredient = extractPrimaryIngredient(query, intent);
      console.log(`[MEALDB_FETCH] Querying MealDB with: "${primaryIngredient}"`);
      const meals = await searchMealDB(primaryIngredient);
      if (meals.length > 0) {
        // Normalize
        const normalized = normalizeManyMealDBRecipes(meals);

        // Filter out recipes already in DB by externalId to avoid redundant upserts
        const existingExtIds = new Set(
          (await prisma.recipe.findMany({ select: { externalId: true } }))
            .map((r) => r.externalId)
            .filter(Boolean),
        );
        const fresh = normalized.filter((n) => !existingExtIds.has(n.externalId));

        // Upsert fresh ones into DB
        let upserted: import('@/lib/repositories/MealDBRecipeRepository').UpsertedRecipe[] = [];
        if (fresh.length > 0) {
          upserted = await batchUpsertMealDB(fresh);
          mealdbCount = upserted.length;
        }

        // Build search results from all normalized meals (including already-existing ones)
        // For already-existing ones, we'll have them in dbResults — so only add truly new ones
        const existingIds = new Set(dbResults.map((r) => r.id));
        mealdbResults = upserted
          .filter((r) => !existingIds.has(r.id))
          .map((r): RecipeSearchResult => {
            const ap = calcAdjustedPrice(r.price, r.servings, intent.servings);
            return {
              id: r.id,
              type: 'meal',
              title: r.name,
              price: r.price,
              adjustedPrice: ap,
              description: r.description ?? r.category,
              score: 0,
              imageUrl: r.imageUrl ?? undefined,
              servings: r.servings ?? undefined,
              displayServings: intent.servings,
              category: r.category,
              tags: r.tags,
              cookTimeMinutes: r.cookTimeMinutes ?? undefined,
              cuisine: r.cuisine ?? undefined,
              calories: r.calories ?? undefined,
              source: 'db',
            };
          });
      }
    } catch (err) {
      console.error('[SEARCH_FALLBACK] MealDB failed:', err instanceof Error ? err.message : err);
      mealdbResults = [];
    }
  }

  // ── STEP 3: Merge DB + MealDB, deduplicate by externalId/title ────────────
  const mergedBase: RecipeSearchResult[] = [...dbResults, ...mealdbResults];

  // Re-rank the full merged set
  if (hasQuery && mergedBase.length > 0) {
    const rankCtx = {
      tokens: intent.rawTokens,
      dietTags: intent.dietTags,
      ingredients: intent.ingredients,
    };
    const reranked = rankResults(mergedBase, rankCtx);
    mergedBase.splice(0, mergedBase.length, ...reranked);
  } else {
    mergedBase.sort((a, b) => b.score - a.score || a.adjustedPrice - b.adjustedPrice);
  }

  // ── STEP 4: AI supplement — only fires if still very sparse ───────────────
  let finalResults: RecipeSearchResult[] = mergedBase;
  let aiResults: RecipeSearchResult[] = [];

  if (hasQuery && mergedBase.length < AI_THRESHOLD) {
    const needed = Math.max(6, AI_THRESHOLD * 2 - mergedBase.length);
    aiResults = await generateRecipesFromIntent(query, intent, needed).catch(() => []);

    if (aiResults.length > 0) {
      const existingTitles = new Set(mergedBase.map((r) => r.title.toLowerCase()));
      const fresh = aiResults
        .filter((r) => !existingTitles.has(r.title.toLowerCase()))
        .map((r) => {
          if (intent.budgetTotal !== undefined && r.adjustedPrice > intent.budgetTotal) {
            return { ...r, score: Math.max(0, r.score - 4) };
          }
          return r;
        });

      const merged = [...mergedBase, ...fresh] as RecipeSearchResult[];
      merged.sort((a, b) => b.score - a.score || a.adjustedPrice - b.adjustedPrice);
      finalResults = merged.slice(0, limit);
    }
  }

  // ── STEP 5: Fallback guarantee — never return empty ───────────────────────
  if (finalResults.length === 0) {
    console.log('[SEARCH_FALLBACK] Using deterministic fallback recipes');
    finalResults = generateFallbackRecipes(intent) as RecipeSearchResult[];
  } else if (hasQuery && finalResults.length < 5) {
    const existingIds = new Set(finalResults.map((r) => r.id));
    const topUp = (generateFallbackRecipes(intent) as RecipeSearchResult[])
      .filter((r) => !existingIds.has(r.id));
    finalResults = [...finalResults, ...topUp].slice(0, 5);
  }

  // ── STEP 6: Shape — dedup titles, diversity caps, guaranteed images ────────
  finalResults = shapeResults(finalResults, limit) as RecipeSearchResult[];

  const fallbackUsed = finalResults.some((r) => r.id.startsWith('fallback-'));

  console.log('[SEARCH_RESULT]', {
    query,
    dbCount: dbResults.length,
    mealdbCount,
    aiCount: aiResults.length,
    finalCount: finalResults.length,
    fallbackUsed,
  });

  const estimatedTotal = parseFloat(
    finalResults.reduce((sum, r) => sum + r.adjustedPrice, 0).toFixed(2),
  );

  return {
    results: finalResults,
    meta: {
      servings: intent.servings ?? null,
      budgetTotal: intent.budgetTotal ?? null,
      estimatedTotal,
      isServingQuery: intent.servings !== undefined,
      isBudgeted: intent.budgetTotal !== undefined,
      dietTags: intent.dietTags,
      intentFlags: intent.intentFlags,
      dbCount: dbResults.length,
      mealdbCount,
      aiCount: aiResults.length,
      realApiCount: 0,
      fallbackUsed,
      totalCount: finalResults.length,
    },
  };
}
