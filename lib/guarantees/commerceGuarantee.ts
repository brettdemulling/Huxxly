import { generateFallbackRecipes } from '@/lib/ai/generateFallbackRecipes';
import { BASELINE_STORE } from '@/lib/stores/getStoresByZip';
import type { SearchResponse, RecipeSearchResult, CartResult } from '@/lib/contracts';

const MIN_SEARCH_RESULTS = 5;

// ─── Search guarantee ─────────────────────────────────────────────────────────

export function ensureSearchResults(response: SearchResponse): SearchResponse {
  if (response.results.length >= MIN_SEARCH_RESULTS) return response;

  const fallbackIntent = { dietTags: response.meta.dietTags, intentFlags: response.meta.intentFlags };

  if (response.results.length === 0) {
    const fallback = generateFallbackRecipes(fallbackIntent, MIN_SEARCH_RESULTS);
    return { ...response, results: fallback as unknown as RecipeSearchResult[] };
  }

  const existingIds = new Set(response.results.map((r) => r.id));
  const topUp = (generateFallbackRecipes(fallbackIntent, MIN_SEARCH_RESULTS) as unknown as RecipeSearchResult[])
    .filter((r) => !existingIds.has(r.id));

  return { ...response, results: [...response.results, ...topUp].slice(0, MIN_SEARCH_RESULTS) };
}

// ─── Store guarantee ──────────────────────────────────────────────────────────

export function ensureStoreAvailability<T extends { id: string }>(stores: T[]): T[] {
  if (stores.length > 0) return stores;
  return [BASELINE_STORE as unknown as T];
}

// ─── Cart guarantee ───────────────────────────────────────────────────────────

export function ensureCartIntegrity(result: CartResult): CartResult {
  // Cart with zero items is valid (user has saved no recipes) — never substitute fake data
  if (result.totalCost < 0) return { ...result, totalCost: 0 };
  return result;
}
