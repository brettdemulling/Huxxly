import { searchRecipes } from '@/lib/search/searchEngine';
import { searchCache } from '@/lib/cache/searchCache';
import { telemetry } from '@/lib/telemetry';
import type { SearchResponse } from '@/lib/contracts';

// Re-export engine types so callers import from this domain boundary, not the engine directly.
export type { SearchResponse, SearchMeta, RecipeSearchResult } from '@/lib/search/searchEngine';

export async function runSearch(query: string, limit = 20): Promise<SearchResponse> {
  const cacheKey = `search:${encodeURIComponent(query)}:${limit}`;
  const cached = searchCache.get(cacheKey);

  if (cached) {
    telemetry.cacheHit('search', cacheKey);
    return cached;
  }

  telemetry.cacheMiss('search', cacheKey);
  const result = await searchRecipes(query, limit);
  searchCache.set(cacheKey, result);
  return result;
}
