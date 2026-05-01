import { runSearch } from '@/lib/domains/search';
import { runCart } from '@/lib/domains/cart';
import { ensureSearchResults, ensureCartResult } from '@/lib/guarantees/commerceGuarantee';
import type { SearchResponse } from '@/lib/domains/search';
import type { CartResult } from '@/lib/domains/cart';

export async function search(query: string, limit = 20): Promise<SearchResponse> {
  const result = await runSearch(query, limit);
  return ensureSearchResults(result);
}

export async function cart(
  userId: string,
  zipCode?: string,
  storeId?: string,
): Promise<CartResult> {
  const result = await runCart(userId, zipCode, storeId);
  return ensureCartResult(result);
}
