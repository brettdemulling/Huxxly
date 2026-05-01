const VIEW_KEY = 'huxxly:recentViews';
const MAX_RECENT = 20;

export interface RecommendableRecipe {
  id: string;
  category: string;
  tags: string[];
  price: number;
}

export function recordView(recipeId: string): void {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const updated = [recipeId, ...ids.filter((id) => id !== recipeId)].slice(0, MAX_RECENT);
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(updated));
  } catch { /* sessionStorage unavailable */ }
}

export function getRecentlyViewedIds(): string[] {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function getSimilarRecipes<T extends RecommendableRecipe>(
  target: T,
  pool: T[],
  limit = 4,
): T[] {
  const targetTags = new Set(target.tags.map((t) => t.toLowerCase()));

  return pool
    .filter((r) => r.id !== target.id)
    .map((r) => {
      let score = 0;
      if (r.category === target.category) score += 3;
      const sharedTags = r.tags.filter((t) => targetTags.has(t.toLowerCase())).length;
      score += sharedTags * 2;
      const priceDelta = Math.abs(r.price - target.price);
      if (priceDelta < 5) score += 2;
      else if (priceDelta < 15) score += 1;
      return { recipe: r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.recipe);
}

export function getTrending<T extends RecommendableRecipe>(pool: T[], limit = 6): T[] {
  // Without view telemetry, surface a stable selection by price diversity
  const byCategory = new Map<string, T[]>();
  for (const r of pool) {
    const arr = byCategory.get(r.category) ?? [];
    arr.push(r);
    byCategory.set(r.category, arr);
  }
  const trending: T[] = [];
  for (const group of byCategory.values()) {
    trending.push(group[0]);
    if (trending.length >= limit) break;
  }
  return trending.slice(0, limit);
}
