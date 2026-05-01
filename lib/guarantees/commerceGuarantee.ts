import { generateFallbackRecipes } from '@/lib/ai/generateFallbackRecipes';
import type { SearchResponse, RecipeSearchResult } from '@/lib/domains/search';
import type { CartResult } from '@/lib/domains/cart';

const MIN_SEARCH_RESULTS = 5;

export function ensureSearchResults(response: SearchResponse): SearchResponse {
  if (response.results.length >= MIN_SEARCH_RESULTS) return response;

  const fallbackIntent = {
    dietTags: response.meta.dietTags,
    intentFlags: response.meta.intentFlags,
  };

  if (response.results.length === 0) {
    const fallback = generateFallbackRecipes(fallbackIntent, MIN_SEARCH_RESULTS);
    return { ...response, results: fallback as unknown as RecipeSearchResult[] };
  }

  const existingIds = new Set(response.results.map((r) => r.id));
  const topUp = (generateFallbackRecipes(fallbackIntent, MIN_SEARCH_RESULTS) as unknown as RecipeSearchResult[])
    .filter((r) => !existingIds.has(r.id));

  return {
    ...response,
    results: [...response.results, ...topUp].slice(0, MIN_SEARCH_RESULTS),
  };
}

export function ensureCartResult(result: CartResult): CartResult {
  return result;
}
