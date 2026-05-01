export type { SearchResponse, SearchMeta, RecipeSearchResult } from '@/lib/search/searchEngine';

import { searchRecipes } from '@/lib/search/searchEngine';
import type { SearchResponse } from '@/lib/search/searchEngine';

export async function runSearch(query: string, limit = 20): Promise<SearchResponse> {
  return searchRecipes(query, limit);
}
