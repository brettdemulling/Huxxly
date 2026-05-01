import type { RecipeEntity, SearchIntent } from '@/lib/contracts';

export interface RankedRecipe extends RecipeEntity {
  score: number;
  adjustedPrice: number;
}

// Scoring weights — isolated here so they can be tuned without touching the domain
const WEIGHTS = {
  dietTagMatch: 5,
  dietNameMatch: 3,
  ingredientName: 4,
  ingredientTag: 2,
  intentCheapMax: 5,
  intentQuick: 4,
  intentHighProtein: 4,
  intentMealPrep: 4,
  intentHealthy: 4,
  intentComfort: 4,
  intentFamily: 3,
  intentGourmet: 3,
  tokenFuzzy: 1,
} as const;

export function rankRecipes(recipes: RecipeEntity[], intent: SearchIntent): RankedRecipe[] {
  return recipes.map((r) => {
    const name = r.name.toLowerCase();
    const cat = r.category.toLowerCase();
    const tags = r.tags.map((t) => t.toLowerCase());
    const full = `${name} ${cat} ${tags.join(' ')}`;
    let score = 0;

    for (const dt of intent.dietTags) {
      const slug = dt.replace('-', '');
      if (tags.some((t) => t === dt || t.replace('-', '') === slug)) score += WEIGHTS.dietTagMatch;
      if (name.includes(dt.replace('-', ' ')) || name.includes(slug)) score += WEIGHTS.dietNameMatch;
    }

    for (const ing of intent.ingredients) {
      if (name.includes(ing)) score += WEIGHTS.ingredientName;
      if (tags.some((t) => t.includes(ing))) score += WEIGHTS.ingredientTag;
      if (cat.includes(ing)) score += WEIGHTS.ingredientTag;
    }

    if (intent.intentFlags.includes('cheap')) {
      score += Math.max(0, WEIGHTS.intentCheapMax - Math.floor(r.price / 8));
    }
    if (intent.intentFlags.includes('quick')) {
      if (tags.some((t) => /quick|fast|easy|simple/.test(t))) score += WEIGHTS.intentQuick;
      if (full.includes('stir') || full.includes('toast') || full.includes('salad')) score += 2;
    }
    if (intent.intentFlags.includes('high-protein')) {
      if (tags.some((t) => /protein|keto|gluten.?free/.test(t))) score += WEIGHTS.intentHighProtein;
      if (['chicken','beef','salmon','shrimp','steak','turkey','pork'].some((p) => name.includes(p))) score += 3;
    }
    if (intent.intentFlags.includes('meal-prep')) {
      if (tags.some((t) => /meal.?prep|batch|healthy/.test(t))) score += WEIGHTS.intentMealPrep;
      if ((r.servings ?? 2) >= 4) score += 3;
    }
    if (intent.intentFlags.includes('healthy')) {
      if (tags.some((t) => /healthy|light|fresh|vegan|vegetarian/.test(t))) score += WEIGHTS.intentHealthy;
      if (['salad','hawaiian','seafood'].includes(cat)) score += 2;
    }
    if (intent.intentFlags.includes('comfort')) {
      if (tags.some((t) => /comfort|hearty|filling|slow.?cook/.test(t))) score += WEIGHTS.intentComfort;
      if (['soup','bbq','american','italian'].includes(cat)) score += 2;
    }
    if (intent.intentFlags.includes('family')) {
      if ((r.servings ?? 2) >= 4) score += WEIGHTS.intentFamily;
      if (tags.some((t) => /comfort|quick|kid/.test(t))) score += 2;
    }
    if (intent.intentFlags.includes('gourmet')) {
      if (r.price >= 25) score += WEIGHTS.intentGourmet;
      if (['seafood','japanese','italian'].includes(cat)) score += 2;
    }

    for (const token of (intent as { rawTokens?: string[] }).rawTokens ?? []) {
      if (full.includes(token)) score += WEIGHTS.tokenFuzzy;
    }
    if (((intent as { rawTokens?: string[] }).rawTokens ?? []).some((t) => cat.includes(t))) score += 1;

    const base = r.servings ?? 2;
    const target = intent.servings ?? base;
    const adjustedPrice = base === target ? r.price : parseFloat(((r.price / base) * target).toFixed(2));

    return { ...r, score, adjustedPrice };
  });
}
