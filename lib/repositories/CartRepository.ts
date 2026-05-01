import { prisma } from '@/lib/db';
import type { ICartRepository, SavedRecipeEntity } from '@/lib/contracts';

export const CartRepository: ICartRepository = {
  async getSavedRecipes(userId: string): Promise<SavedRecipeEntity[]> {
    const rows = await prisma.savedRecipe.findMany({
      where: { userId },
      include: { recipe: true },
    });
    return rows.map((s) => ({
      id: s.id,
      userId: s.userId,
      recipeId: s.recipeId,
      recipe: {
        id: s.recipe.id,
        name: s.recipe.name,
        price: s.recipe.price,
        category: s.recipe.category,
        tags: s.recipe.tags,
        imageUrl: s.recipe.imageUrl,
        servings: s.recipe.servings,
      },
    }));
  },
};
