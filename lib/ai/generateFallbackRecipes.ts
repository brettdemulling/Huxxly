// Deterministic fallback — no external API, no DB dependency.
// Called when both DB and AI sources return empty results.
// Structurally matches RecipeSearchResult / AIRecipeResult (no import needed).

export interface FallbackIntent {
  servings?: number;
  budgetTotal?: number;
  dietTags: string[];
  intentFlags: string[];
}

export interface FallbackRecipe {
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

const POOL: FallbackRecipe[] = [
  {
    id: 'fallback-chicken-rice-bowl',
    type: 'meal',
    title: 'Crispy Chicken Rice Bowl',
    price: 14,
    adjustedPrice: 14,
    description: 'Juicy pan-seared chicken over steamed jasmine rice with fresh vegetables.',
    score: 2,
    servings: 4,
    category: 'american',
    tags: ['quick', 'healthy', 'high-protein'],
  },
  {
    id: 'fallback-turkey-pasta',
    type: 'meal',
    title: 'Turkey Pasta Skillet',
    price: 16,
    adjustedPrice: 16,
    description: 'Ground turkey with penne pasta in a light tomato herb sauce.',
    score: 2,
    servings: 4,
    category: 'italian',
    tags: ['quick', 'family', 'comfort'],
  },
  {
    id: 'fallback-sheet-pan-chicken',
    type: 'meal',
    title: 'Sheet Pan Chicken & Veggies',
    price: 18,
    adjustedPrice: 18,
    description: 'Oven-roasted chicken thighs with seasonal roasted vegetables.',
    score: 2,
    servings: 4,
    category: 'american',
    tags: ['healthy', 'family', 'meal-prep'],
  },
  {
    id: 'fallback-beef-stir-fry',
    type: 'meal',
    title: 'Budget Beef Stir Fry',
    price: 12,
    adjustedPrice: 12,
    description: 'Lean beef strips with mixed vegetables over steamed rice.',
    score: 2,
    servings: 4,
    category: 'asian',
    tags: ['cheap', 'quick', 'high-protein'],
  },
  {
    id: 'fallback-egg-rice-bowl',
    type: 'meal',
    title: 'Egg & Rice Protein Bowl',
    price: 8,
    adjustedPrice: 8,
    description: 'Scrambled eggs over rice with soy sauce and sesame oil.',
    score: 2,
    servings: 2,
    category: 'american',
    tags: ['cheap', 'quick', 'high-protein', 'vegetarian'],
  },
  {
    id: 'fallback-black-bean-tacos',
    type: 'meal',
    title: 'Black Bean Tacos',
    price: 10,
    adjustedPrice: 10,
    description: 'Spiced black beans in corn tortillas with fresh salsa and avocado.',
    score: 2,
    servings: 4,
    category: 'mexican',
    tags: ['vegan', 'vegetarian', 'cheap', 'quick'],
  },
  {
    id: 'fallback-salmon-broccoli',
    type: 'meal',
    title: 'Salmon & Broccoli Bake',
    price: 22,
    adjustedPrice: 22,
    description: 'Oven-baked salmon fillets with garlic roasted broccoli.',
    score: 2,
    servings: 2,
    category: 'seafood',
    tags: ['healthy', 'high-protein', 'gluten-free'],
  },
  {
    id: 'fallback-veggie-pasta',
    type: 'meal',
    title: 'Veggie Pasta Primavera',
    price: 13,
    adjustedPrice: 13,
    description: 'Penne with seasonal vegetables in olive oil and garlic.',
    score: 2,
    servings: 4,
    category: 'italian',
    tags: ['vegetarian', 'healthy', 'quick'],
  },
];

export function generateFallbackRecipes(intent: FallbackIntent, count = 5): FallbackRecipe[] {
  const targetServings = intent.servings ?? 4;

  const scored = POOL.map((r) => {
    let score = r.score;
    const tags = r.tags;

    // Boost recipes that match requested diet tags
    for (const dietTag of intent.dietTags) {
      const slug = dietTag.replace('-', '');
      if (tags.some((t) => t === dietTag || t.replace('-', '') === slug)) score += 3;
    }

    // Boost recipes that match intent flags
    if (intent.intentFlags.includes('cheap') && tags.includes('cheap')) score += 2;
    if (intent.intentFlags.includes('healthy') && tags.includes('healthy')) score += 2;
    if (intent.intentFlags.includes('quick') && tags.includes('quick')) score += 2;
    if (intent.intentFlags.includes('high-protein') && tags.includes('high-protein')) score += 2;
    if (intent.intentFlags.includes('meal-prep') && tags.includes('meal-prep')) score += 2;
    if (intent.intentFlags.includes('family') && (r.servings ?? 2) >= 4) score += 2;
    if (intent.intentFlags.includes('comfort') && tags.includes('comfort')) score += 2;

    // Adjust price proportionally for requested servings
    const base = r.servings ?? 4;
    const adjustedPrice = base === targetServings
      ? r.price
      : parseFloat(((r.price / base) * targetServings).toFixed(2));

    // Soft budget penalty — deprioritise but never exclude
    if (intent.budgetTotal !== undefined && adjustedPrice > intent.budgetTotal) {
      score = Math.max(0, score - 3);
    }

    return { ...r, adjustedPrice, displayServings: intent.servings, score };
  });

  scored.sort((a, b) => b.score - a.score || a.adjustedPrice - b.adjustedPrice);
  return scored.slice(0, count);
}
