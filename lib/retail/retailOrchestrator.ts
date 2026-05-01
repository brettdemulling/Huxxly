/**
 * Retail source registry and router.
 *
 * Reports which external retail sources are configured and routes
 * single-source queries. Only activates when credentials exist.
 * Returns empty results — never fake data — when unconfigured.
 */
import { searchProducts, type RealProduct } from '@/lib/products/productOrchestrator';

export type RetailSource =
  | 'spoonacular'
  | 'walmart'
  | 'kroger'
  | 'instacart_affiliate'
  | 'local_db';

export interface SourceStatus {
  source: RetailSource;
  configured: boolean;
  label: string;
}

export interface RetailSearchResult {
  source: RetailSource;
  configured: boolean;
  products: RealProduct[];
}

// ─── Configuration registry ───────────────────────────────────────────────────

const SOURCE_ENV: Record<RetailSource, string | undefined> = {
  spoonacular: process.env.SPOONACULAR_API_KEY,
  walmart: process.env.WALMART_API_KEY,
  kroger: process.env.KROGER_API_KEY,
  instacart_affiliate: process.env.INSTACART_AFFILIATE_ID,
  local_db: 'always', // always available
};

export function isSourceConfigured(source: RetailSource): boolean {
  return !!SOURCE_ENV[source];
}

export function getSourceStatuses(): SourceStatus[] {
  return (Object.keys(SOURCE_ENV) as RetailSource[]).map((source) => ({
    source,
    configured: isSourceConfigured(source),
    label: {
      spoonacular: 'Spoonacular Recipes API',
      walmart: 'Walmart Affiliate API',
      kroger: 'Kroger Products API',
      instacart_affiliate: 'Instacart Affiliate',
      local_db: 'Local Database',
    }[source],
  }));
}

export function getConfiguredSources(): RetailSource[] {
  return (Object.keys(SOURCE_ENV) as RetailSource[]).filter(isSourceConfigured);
}

// ─── Search router ────────────────────────────────────────────────────────────

/**
 * Search from a specific source only.
 * Returns empty if that source is not configured.
 * Never returns fake/mock products.
 */
export async function searchFromSource(
  source: RetailSource,
  query: string,
  limit = 20,
): Promise<RetailSearchResult> {
  if (!isSourceConfigured(source)) {
    return { source, configured: false, products: [] };
  }

  try {
    // Route to productOrchestrator which handles all real API calls
    // For source-specific queries we use the full orchestrator and filter by source
    const all = await searchProducts(query, limit * 2);
    const filtered =
      source === 'local_db'
        ? all.filter((p) => p.source === 'db')
        : all.filter((p) => p.source === (source === 'instacart_affiliate' ? 'spoonacular' : source));

    return { source, configured: true, products: filtered.slice(0, limit) };
  } catch (err) {
    console.log('[commerce]', {
      action: 'search',
      source,
      success: false,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { source, configured: true, products: [] };
  }
}

/**
 * Search across all configured sources simultaneously.
 */
export async function searchAllSources(
  query: string,
  limit = 20,
): Promise<RetailSearchResult[]> {
  const configured = getConfiguredSources();

  const results = await Promise.allSettled(
    configured.map((source) => searchFromSource(source, query, limit)),
  );

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: configured[i], configured: true, products: [] },
  );
}
