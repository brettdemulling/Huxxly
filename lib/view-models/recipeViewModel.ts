/**
 * RecipeViewModel — the single contract between backend and frontend.
 * Frontend NEVER consumes raw DB or AI objects directly.
 */
export interface RecipeViewModel {
  id: string;
  title: string;
  image: string;           // NEVER null — imageResolver guarantees this
  cookTime: number;        // minutes, 0 if unknown
  servings: number;
  pricePerServing: number;
  totalPrice: number;
  tags: string[];
  dietaryFlags: string[];  // subset of tags that are dietary restrictions
  cuisine: string;
  calories: number | null;
  source: 'db' | 'ai' | 'fallback';
  confidenceScore: number;
  isClickable: true;       // literal true — enforces the clickability contract
  isSaved: boolean;
  // Fields kept for cart/save/swap compatibility
  category: string;
  price: number;           // base price (pre-serving adjustment)
  adjustedPrice: number;
  displayServings?: number;
}

const DIETARY_KEYWORDS = new Set([
  'vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'keto',
  'paleo', 'nut-free', 'low-carb', 'high-protein', 'low-fat', 'halal', 'kosher',
]);

function extractDietaryFlags(tags: string[]): string[] {
  return tags.filter((t) => DIETARY_KEYWORDS.has(t.toLowerCase()));
}

export interface RawSearchResult {
  id: string;
  title: string;
  price: number;
  adjustedPrice: number;
  category: string;
  tags: string[];
  imageUrl?: string;
  servings?: number;
  displayServings?: number;
  score: number;
  source?: 'db' | 'ai' | 'fallback';
  cookTimeMinutes?: number;
  cuisine?: string;
  calories?: number;
}

export function toRecipeViewModel(
  result: RawSearchResult,
  isSaved = false,
): RecipeViewModel {
  const servings = result.displayServings ?? result.servings ?? 4;
  const totalPrice = result.adjustedPrice ?? result.price;
  const pricePerServing = servings > 0 ? parseFloat((totalPrice / servings).toFixed(2)) : totalPrice;

  return {
    id: result.id,
    title: result.title,
    image: result.imageUrl ?? 'https://placehold.co/480x200/059669/FFFFFF?text=Recipe',
    cookTime: result.cookTimeMinutes ?? 0,
    servings,
    pricePerServing,
    totalPrice,
    tags: result.tags,
    dietaryFlags: extractDietaryFlags(result.tags),
    cuisine: result.cuisine ?? 'International',
    calories: result.calories ?? null,
    source: result.source ?? 'db',
    confidenceScore: result.score,
    isClickable: true,
    isSaved,
    // Compatibility fields
    category: result.category,
    price: result.price,
    adjustedPrice: result.adjustedPrice,
    displayServings: result.displayServings,
  };
}
