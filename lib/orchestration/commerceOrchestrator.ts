import { runSearch } from '@/lib/domains/search';
import { runCart } from '@/lib/domains/cart';
import { ensureSearchResults, ensureCartIntegrity } from '@/lib/guarantees/commerceGuarantee';
import { telemetry } from '@/lib/telemetry';
import type { SearchResponse, CartResult } from '@/lib/contracts';

// ─── Search flow ──────────────────────────────────────────────────────────────

export async function search(query: string, limit = 20): Promise<SearchResponse> {
  const start = Date.now();
  const raw = await runSearch(query, limit);
  const result = ensureSearchResults(raw);

  telemetry.searchCompleted({
    query,
    dbCount: result.meta.dbCount,
    aiCount: result.meta.aiCount,
    fallbackUsed: result.meta.fallbackUsed,
    finalCount: result.meta.totalCount,
    durationMs: Date.now() - start,
  });

  return result;
}

// ─── Cart flow ────────────────────────────────────────────────────────────────

export async function cart(
  userId: string,
  zipCode?: string,
  storeId?: string,
): Promise<CartResult> {
  const start = Date.now();
  const raw = await runCart(userId, zipCode, storeId);
  const result = ensureCartIntegrity(raw);

  telemetry.pricingApplied({
    storeId: result.storeId ?? 'baseline',
    itemCount: result.items.length,
    totalCost: result.totalCost,
    durationMs: Date.now() - start,
  });

  return result;
}
