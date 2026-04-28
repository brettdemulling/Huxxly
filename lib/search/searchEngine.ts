import { prisma } from '@/lib/db';

// ─── Public result type ───────────────────────────────────────────────────────

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

  // Servings
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

  // Budget
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

  // Diet tags
  const dietTags = DIET_PATTERNS.flatMap(([rx, tag]) => (rx.test(q) ? [tag] : []));

  // Intent flags
  const intentFlags = INTENT_PATTERNS.flatMap(([rx, flag]) => (rx.test(q) ? [flag] : []));

  // Ingredients
  const ingredients = KNOWN_INGREDIENTS.filter((ing) => q.includes(ing));

  // Raw tokens — words left after removing known signal words
  const rawTokens = q
    .split(/[\s,]+/)
    .map((w) => w.replace(/[^a-z]/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

  return { servings, budgetTotal, dietTags, intentFlags, ingredients, rawTokens };
}

// ─── Scorer ───────────────────────────────────────────────────────────────────

type PrismaRecipe = {
  id: string;
  name: string;
  price: number;
  category: string;
  tags: string[];
  imageUrl: string | null;
  servings: number | null;
};

function scoreRecipe(r: PrismaRecipe, intent: ParsedIntent): number {
  const name = r.name.toLowerCase();
  const cat = r.category.toLowerCase();
  const tags = r.tags.map((t) => t.toLowerCase());
  const full = `${name} ${cat} ${tags.join(' ')}`;

  let score = 0;

  // Diet tag matches — highest signal
  for (const dietTag of intent.dietTags) {
    const slug = dietTag.replace('-', '');
    if (tags.some((t) => t === dietTag || t.replace('-', '') === slug)) score += 5;
    if (name.includes(dietTag.replace('-', ' ')) || name.includes(slug)) score += 3;
  }

  // Ingredient matches
  for (const ing of intent.ingredients) {
    if (name.includes(ing)) score += 4;
    if (tags.some((t) => t.includes(ing))) score += 2;
    if (cat.includes(ing)) score += 2;
  }

  // Intent flag scoring
  if (intent.intentFlags.includes('cheap')) {
    // Cheaper recipes rank higher — score inversely proportional to price
    const priceRank = Math.max(0, 5 - Math.floor(r.price / 8));
    score += priceRank;
  }
  if (intent.intentFlags.includes('quick')) {
    if (tags.some((t) => /quick|fast|easy|simple/.test(t))) score += 4;
    if (full.includes('stir') || full.includes('toast') || full.includes('salad')) score += 2;
  }
  if (intent.intentFlags.includes('high-protein')) {
    if (tags.some((t) => /protein|keto|gluten.?free/.test(t))) score += 4;
    if (['chicken', 'beef', 'salmon', 'shrimp', 'steak', 'turkey', 'pork'].some((p) => name.includes(p))) score += 3;
  }
  if (intent.intentFlags.includes('meal-prep')) {
    if (tags.some((t) => /meal.?prep|batch|healthy/.test(t))) score += 4;
    if ((r.servings ?? 2) >= 4) score += 3;
  }
  if (intent.intentFlags.includes('healthy')) {
    if (tags.some((t) => /healthy|light|fresh|vegan|vegetarian/.test(t))) score += 4;
    if (cat === 'salad' || cat === 'hawaiian' || cat === 'seafood') score += 2;
  }
  if (intent.intentFlags.includes('comfort')) {
    if (tags.some((t) => /comfort|hearty|filling|slow.?cook/.test(t))) score += 4;
    if (['soup', 'bbq', 'american', 'italian'].includes(cat)) score += 2;
  }
  if (intent.intentFlags.includes('family')) {
    if ((r.servings ?? 2) >= 4) score += 3;
    if (tags.some((t) => /comfort|quick|kid/.test(t))) score += 2;
  }
  if (intent.intentFlags.includes('gourmet')) {
    if (r.price >= 25) score += 3;
    if (['seafood', 'japanese', 'italian'].includes(cat)) score += 2;
  }

  // Raw token fuzzy matches
  for (const token of intent.rawTokens) {
    if (full.includes(token)) score += 1;
  }

  // Category name match as fallback
  if (intent.rawTokens.some((t) => cat.includes(t))) score += 1;

  return score;
}

// ─── Price/serving adjustment ─────────────────────────────────────────────────

function adjustedPrice(recipe: PrismaRecipe, queryServings?: number): number {
  const base = recipe.servings ?? 2;
  if (!queryServings || queryServings === base) return recipe.price;
  return parseFloat(((recipe.price / base) * queryServings).toFixed(2));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function searchRecipes(query: string, limit = 20): Promise<RecipeSearchResult[]> {
  const intent = parseIntent(query.trim());
  const hasQuery = query.trim().length > 0;

  const allRecipes = await prisma.recipe.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const results = allRecipes
    .map((r) => {
      const sc = hasQuery ? scoreRecipe(r, intent) : 1;
      const ap = adjustedPrice(r, intent.servings);
      return { r, score: sc, ap };
    })
    // When query is present, drop recipes with zero relevance
    .filter(({ score }) => !hasQuery || score > 0)
    // Budget filter: per-recipe adjusted price must fit within stated total
    .filter(({ ap }) => intent.budgetTotal === undefined || ap <= intent.budgetTotal)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ r, score, ap }): RecipeSearchResult => ({
      id: r.id,
      type: 'meal',
      title: r.name,
      price: r.price,
      adjustedPrice: ap,
      description: `${r.category} · ${r.tags.slice(0, 3).join(', ')}`,
      score,
      imageUrl: r.imageUrl ?? undefined,
      servings: r.servings ?? undefined,
      displayServings: intent.servings,
      category: r.category,
      tags: r.tags,
    }));

  return results;
}
