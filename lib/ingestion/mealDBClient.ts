/**
 * TheMealDB API client — free tier, no key required.
 * Base URL: https://www.themealdb.com/api/json/v1/1/
 */

const BASE = 'https://www.themealdb.com/api/json/v1/1';

export interface MealDBCategory {
  idCategory: string;
  strCategory: string;
  strCategoryThumb: string;
  strCategoryDescription: string;
}

export interface MealDBSummary {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
}

export interface MealDBDetail {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strYoutube?: string;
  strSource?: string;
  strIngredient1?: string;  strIngredient2?: string;  strIngredient3?: string;
  strIngredient4?: string;  strIngredient5?: string;  strIngredient6?: string;
  strIngredient7?: string;  strIngredient8?: string;  strIngredient9?: string;
  strIngredient10?: string; strIngredient11?: string; strIngredient12?: string;
  strIngredient13?: string; strIngredient14?: string; strIngredient15?: string;
  strIngredient16?: string; strIngredient17?: string; strIngredient18?: string;
  strIngredient19?: string; strIngredient20?: string;
  strMeasure1?: string;  strMeasure2?: string;  strMeasure3?: string;
  strMeasure4?: string;  strMeasure5?: string;  strMeasure6?: string;
  strMeasure7?: string;  strMeasure8?: string;  strMeasure9?: string;
  strMeasure10?: string; strMeasure11?: string; strMeasure12?: string;
  strMeasure13?: string; strMeasure14?: string; strMeasure15?: string;
  strMeasure16?: string; strMeasure17?: string; strMeasure18?: string;
  strMeasure19?: string; strMeasure20?: string;
}

export interface ParsedIngredient {
  name: string;
  measure: string;
}

export function extractIngredients(meal: MealDBDetail): ParsedIngredient[] {
  const ingredients: ParsedIngredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}` as keyof MealDBDetail] as string | undefined;
    const measure = meal[`strMeasure${i}` as keyof MealDBDetail] as string | undefined;
    if (name && name.trim()) {
      ingredients.push({ name: name.trim(), measure: (measure ?? '').trim() });
    }
  }
  return ingredients;
}

export function parseInstructions(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 10)
    .slice(0, 20);
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`MealDB HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

export async function fetchCategories(): Promise<MealDBCategory[]> {
  const data = await fetchJSON<{ categories: MealDBCategory[] }>(`${BASE}/categories.php`);
  return data.categories ?? [];
}

export async function fetchMealsByCategory(category: string): Promise<MealDBSummary[]> {
  const data = await fetchJSON<{ meals: MealDBSummary[] | null }>(
    `${BASE}/filter.php?c=${encodeURIComponent(category)}`,
  );
  return data.meals ?? [];
}

export async function fetchMealDetail(mealId: string): Promise<MealDBDetail | null> {
  const data = await fetchJSON<{ meals: MealDBDetail[] | null }>(
    `${BASE}/lookup.php?i=${mealId}`,
  );
  return data.meals?.[0] ?? null;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
