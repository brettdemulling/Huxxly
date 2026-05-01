import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { runtime } from '@/lib/config/runtime';

// ─── Local types (no import from searchEngine to avoid circular deps) ─────────

interface QueryIntent {
  servings?: number;
  budgetTotal?: number;
  dietTags: string[];
  intentFlags: string[];
}

interface RawRecipe {
  name: string;
  price: number;
  category: string;
  tags: string[];
  servings: number;
  description: string;
}

// Structurally compatible with RecipeSearchResult — checked by TypeScript at call site
export interface AIRecipeResult {
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const VALID_CATEGORIES = new Set([
  'american', 'italian', 'mexican', 'asian', 'mediterranean',
  'indian', 'breakfast', 'salad', 'soup', 'bbq', 'seafood', 'hawaiian', 'japanese',
]);

function toStableId(name: string): string {
  return ('ai-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')).slice(0, 48);
}

function sanitize(raw: unknown): RawRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) return null;
  return {
    name,
    price: typeof r.price === 'number' && r.price > 0 ? Math.round(r.price * 100) / 100 : 14,
    category: typeof r.category === 'string' && VALID_CATEGORIES.has(r.category.toLowerCase())
      ? r.category.toLowerCase() : 'american',
    tags: Array.isArray(r.tags)
      ? r.tags.filter((t): t is string => typeof t === 'string').slice(0, 6)
      : [],
    servings: typeof r.servings === 'number' && r.servings > 0 ? Math.round(r.servings) : 4,
    description: typeof r.description === 'string' ? r.description.trim().slice(0, 200) : '',
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateRecipesFromIntent(
  query: string,
  intent: QueryIntent,
  count = 8,
): Promise<AIRecipeResult[]> {
  if (!runtime.isAIEnabled) return [];

  const targetServings = intent.servings ?? 4;
  const budgetLine = intent.budgetTotal
    ? `Each meal must cost under $${intent.budgetTotal.toFixed(0)} total.`
    : 'Price each meal realistically between $8 and $35 total.';

  const prompt = `Generate ${count} unique, realistic grocery-store meal recipes for this search: "${query}"

Each recipe serves ${targetServings} people.
${budgetLine}
${intent.dietTags.length ? `All recipes must satisfy: ${intent.dietTags.join(', ')}.` : ''}
${intent.intentFlags.length ? `Style context: ${intent.intentFlags.join(', ')}.` : ''}

Requirements:
- Names must be specific and appetizing ("Crispy Garlic Chicken Thighs", not "Chicken Dish")
- All ingredients shoppable from Walmart, Kroger, or Target
- No duplicate meal names
- 2–5 accurate, searchable tags per recipe
- Tags may include: quick, healthy, high-protein, vegetarian, vegan, comfort, family, meal-prep, cheap, gluten-free, keto, dairy-free

Return ONLY a JSON array — no markdown, no code fences, no explanation.

Required shape per item:
{
  "name": "string",
  "price": number,
  "category": "american|italian|mexican|asian|mediterranean|indian|breakfast|salad|soup|bbq|seafood|hawaiian|japanese",
  "tags": ["string"],
  "servings": number,
  "description": "one sentence"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!block) return [];

    // Strip possible markdown fences before parsing
    const text = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    const parsed = JSON.parse(text) as unknown[];
    if (!Array.isArray(parsed)) return [];

    const recipes = parsed.map(sanitize).filter((r): r is RawRecipe => r !== null);

    // Upsert into Recipe table so save / cart / meal-plan flows work normally.
    // Stable ID means the same recipe name always maps to the same row.
    await Promise.all(
      recipes.map((r) =>
        prisma.recipe.upsert({
          where: { id: toStableId(r.name) },
          create: {
            id: toStableId(r.name),
            name: r.name,
            price: r.price,
            category: r.category,
            tags: r.tags,
            servings: r.servings,
          },
          update: {
            price: r.price,
            category: r.category,
            tags: r.tags,
            servings: r.servings,
          },
        }),
      ),
    );

    return recipes.map((r): AIRecipeResult => {
      const adj = r.servings === targetServings
        ? r.price
        : parseFloat(((r.price / r.servings) * targetServings).toFixed(2));
      return {
        id: toStableId(r.name),
        type: 'meal',
        title: r.name,
        price: r.price,
        adjustedPrice: adj,
        description: r.description || `${r.category} · ${r.tags.slice(0, 3).join(', ')}`,
        score: 3, // below high-scoring DB results, above zero-relevance fallbacks
        imageUrl: undefined,
        servings: r.servings,
        displayServings: intent.servings,
        category: r.category,
        tags: r.tags,
      };
    });
  } catch (err) {
    console.error(
      '[generateRecipes] AI generation failed, falling back to DB-only results:',
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}
