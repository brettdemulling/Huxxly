import { prisma } from '@/lib/db';
import type { IRecipeRepository, RecipeEntity } from '@/lib/contracts';

function toEntity(r: {
  id: string; name: string; price: number; category: string;
  tags: string[]; imageUrl: string | null; servings: number | null;
}): RecipeEntity {
  return { id: r.id, name: r.name, price: r.price, category: r.category, tags: r.tags, imageUrl: r.imageUrl, servings: r.servings };
}

export const RecipeRepository: IRecipeRepository = {
  async findAll(): Promise<RecipeEntity[]> {
    const rows = await prisma.recipe.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toEntity);
  },

  async findById(id: string): Promise<RecipeEntity | null> {
    const row = await prisma.recipe.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  },

  async upsert(recipe: Omit<RecipeEntity, 'createdAt'>): Promise<RecipeEntity> {
    const row = await prisma.recipe.upsert({
      where: { id: recipe.id },
      create: { id: recipe.id, name: recipe.name, price: recipe.price, category: recipe.category, tags: recipe.tags, servings: recipe.servings },
      update: { price: recipe.price, category: recipe.category, tags: recipe.tags, servings: recipe.servings },
    });
    return toEntity(row);
  },
};
