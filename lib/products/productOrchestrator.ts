/**
 * Single entry point for all product/recipe data.
 *
 * Priority order:
 *   1. Spoonacular API  (if SPOONACULAR_API_KEY is set)
 *   2. Kroger API       (if KROGER_API_KEY is set — stub ready for OAuth)
 *   3. Walmart API      (if WALMART_API_KEY is set — stub ready for Affiliate API)
 *   4. Prisma database  (always — the final fallback)
 *
 * NEVER returns fake/mock product data.
 * If no real source is available, returns DB records only.
 */
import { prisma } from '@/lib/db';

// ─── Canonical product shape ──────────────────────────────────────────────────

export type RealProductSource = 'spoonacular' | 'kroger' | 'walmart' | 'db';

export interface RealProduct {
  id: string;
  source: RealProductSource;
  title: string;
  price: number;
  imageUrl: string | null;
  servings: number;
  category: string;
  tags: string[];
  available: boolean;
}

// ─── Spoonacular ──────────────────────────────────────────────────────────────

interface SpoonacularResult {
  id: number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  pricePerServing?: number;
  diets?: string[];
  dishTypes?: string[];
}

interface SpoonacularResponse {
  results: SpoonacularResult[];
  totalResults: number;
}

async function trySpoonacular(query: string, limit: number): Promise<RealProduct[]> {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) return [];

  try {
    const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
    url.searchParams.set('query', query);
    url.searchParams.set('number', String(Math.min(limit, 10)));
    url.searchParams.set('addRecipeInformation', 'true');
    url.searchParams.set('fillIngredients', 'false');
    url.searchParams.set('apiKey', key);

    const res = await fetch(url.toString(), {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      console.log('[commerce]', { action: 'search', source: 'spoonacular', success: false, status: res.status });
      return [];
    }

    const data = await res.json() as SpoonacularResponse;

    console.log('[commerce]', {
      action: 'search',
      source: 'spoonacular',
      success: true,
      count: data.results.length,
    });

    return data.results.map((r): RealProduct => {
      const servings = r.servings ?? 4;
      const pricePerServing = r.pricePerServing ?? 0;
      // Spoonacular pricePerServing is in cents → convert to dollars for total
      const totalPrice = parseFloat(((pricePerServing / 100) * servings).toFixed(2));
      const category = r.dishTypes?.[0] ?? 'recipe';
      const tags = [
        ...(r.diets ?? []),
        ...(r.dishTypes?.slice(1, 3) ?? []),
      ].slice(0, 5);

      return {
        id: `spoon-${r.id}`,
        source: 'spoonacular',
        title: r.title,
        price: totalPrice,
        imageUrl: r.image ?? null,
        servings,
        category,
        tags,
        available: true,
      };
    });
  } catch (err) {
    console.log('[commerce]', {
      action: 'search',
      source: 'spoonacular',
      success: false,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return [];
  }
}

// ─── Kroger (credential-gated stub, ready for OAuth integration) ──────────────

async function tryKroger(_query: string, _limit: number): Promise<RealProduct[]> {
  if (!process.env.KROGER_API_KEY) return [];
  // Kroger requires OAuth 2.0 client_credentials flow.
  // Integration point: exchange KROGER_API_KEY for access token, then
  // call GET /v1/products?filter.term={query}&filter.locationId={locationId}
  // Skipping until OAuth flow is configured.
  console.log('[commerce]', { action: 'search', source: 'kroger', success: false, reason: 'OAuth not configured' });
  return [];
}

// ─── Walmart (credential-gated stub, ready for Affiliate API) ─────────────────

async function tryWalmart(_query: string, _limit: number): Promise<RealProduct[]> {
  if (!process.env.WALMART_API_KEY) return [];
  // Walmart Open API requires approved affiliate account.
  // Integration point: GET https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search
  // with WM_SVC.NAME, WM_QOS.CORRELATION_ID headers and HMAC-SHA256 signature.
  // Skipping until affiliate credentials are approved.
  console.log('[commerce]', { action: 'search', source: 'walmart', success: false, reason: 'Affiliate credentials not configured' });
  return [];
}

// ─── Database fallback ────────────────────────────────────────────────────────

async function fromDatabase(query: string, limit: number): Promise<RealProduct[]> {
  try {
    const where = query.trim()
      ? {
          OR: [
            { name: { contains: query.trim(), mode: 'insensitive' as const } },
            { category: { contains: query.trim(), mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const recipes = await prisma.recipe.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return recipes.map((r): RealProduct => ({
      id: r.id,
      source: 'db',
      title: r.name,
      price: r.price,
      imageUrl: r.imageUrl ?? null,
      servings: r.servings ?? 4,
      category: r.category,
      tags: r.tags,
      available: true,
    }));
  } catch (err) {
    console.log('[commerce]', { action: 'search', source: 'db', success: false, error: err instanceof Error ? err.message : 'unknown' });
    return [];
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function searchProducts(query: string, limit = 20): Promise<RealProduct[]> {
  const results: RealProduct[] = [];
  const seenTitles = new Set<string>();

  function addUnique(products: RealProduct[]): void {
    for (const p of products) {
      const key = p.title.toLowerCase();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        results.push(p);
      }
    }
  }

  // Step 1: Spoonacular
  const spoon = await trySpoonacular(query, limit);
  addUnique(spoon);
  if (results.length >= limit) {
    return results.slice(0, limit);
  }

  // Step 2: Kroger (if configured)
  const kroger = await tryKroger(query, limit - results.length);
  addUnique(kroger);

  // Step 3: Walmart (if configured)
  const walmart = await tryWalmart(query, limit - results.length);
  addUnique(walmart);

  // Step 4: DB fallback — fills remaining slots
  const needed = limit - results.length;
  if (needed > 0) {
    const dbRecipes = await fromDatabase(query, needed);
    addUnique(dbRecipes);
  }

  const apiCount = spoon.length + kroger.length + walmart.length;
  console.log('[commerce]', {
    action: 'search',
    source: apiCount > 0 ? 'api+db' : 'db',
    success: results.length > 0,
    total: results.length,
    breakdown: { spoonacular: spoon.length, kroger: kroger.length, walmart: walmart.length, db: results.length - apiCount },
  });

  return results.slice(0, limit);
}

export function productApiConfigured(): boolean {
  return !!(
    process.env.SPOONACULAR_API_KEY ||
    process.env.KROGER_API_KEY ||
    process.env.WALMART_API_KEY
  );
}
