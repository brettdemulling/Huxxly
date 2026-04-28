import { prisma } from '@/lib/db';

export interface RecipeSearchResult {
  id: string;
  type: 'meal';
  title: string;
  price: number;
  description: string;
  score: number;
  imageUrl?: string;
  servings?: number;
  category: string;
  tags: string[];
}

export async function searchRecipes(query: string, limit = 20): Promise<RecipeSearchResult[]> {
  const q = query.trim().toLowerCase();

  const recipes = await prisma.recipe.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
  });

  const scored = recipes.map((r) => {
    let score = 0;
    const name = r.name.toLowerCase();
    const cat = r.category.toLowerCase();
    const tags = r.tags.map((t) => t.toLowerCase());

    if (!q) {
      score = 1;
    } else {
      if (name.includes(q)) score += 3;
      if (cat.includes(q)) score += 2;
      if (tags.some((t) => t.includes(q))) score += 1;
      if (q.split(' ').some((w) => name.includes(w))) score += 1;
    }

    return {
      id: r.id,
      type: 'meal' as const,
      title: r.name,
      price: r.price,
      description: `${r.category} · ${r.tags.slice(0, 3).join(', ')}`,
      score,
      imageUrl: r.imageUrl ?? undefined,
      servings: r.servings ?? undefined,
      category: r.category,
      tags: r.tags,
    };
  });

  return scored
    .filter((r) => !q || r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
