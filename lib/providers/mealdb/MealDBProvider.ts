/**
 * MealDB Provider — production wrapper with retry, timeout, and safety checks.
 * Uses the free-tier API (no key required).
 */
import type { MealDBDetail } from '@/lib/ingestion/mealDBClient';

const BASE = 'https://www.themealdb.com/api/json/v1/1';
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;

async function fetchWithRetry<T>(url: string, attempt = 0): Promise<T> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`MealDB HTTP ${res.status}`);
    const json = await res.json() as T;
    return json;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      return fetchWithRetry<T>(url, attempt + 1);
    }
    throw err;
  }
}

export async function searchRecipes(query: string): Promise<MealDBDetail[]> {
  const q = query.trim();
  if (!q) return [];
  console.log(`[MEALDB_FETCH] search query="${q}"`);
  const data = await fetchWithRetry<{ meals: MealDBDetail[] | null }>(
    `${BASE}/search.php?s=${encodeURIComponent(q)}`,
  );
  const meals = data.meals ?? [];
  console.log(`[MEALDB_FETCH] returned ${meals.length} results`);
  return meals;
}

export async function lookupRecipe(id: string): Promise<MealDBDetail | null> {
  console.log(`[MEALDB_FETCH] lookup id=${id}`);
  const data = await fetchWithRetry<{ meals: MealDBDetail[] | null }>(
    `${BASE}/lookup.php?i=${id}`,
  );
  return data.meals?.[0] ?? null;
}

export async function getRandomRecipes(): Promise<MealDBDetail[]> {
  const data = await fetchWithRetry<{ meals: MealDBDetail[] | null }>(
    `${BASE}/random.php`,
  );
  return data.meals ?? [];
}
