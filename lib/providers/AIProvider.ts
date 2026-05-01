import { generateRecipesFromIntent } from '@/lib/ai/generateRecipes';
import { generateFallbackRecipes } from '@/lib/ai/generateFallbackRecipes';
import type { IAIProvider, AIGenerationInput, RecipeSearchResult } from '@/lib/contracts';

export const AIProvider: IAIProvider = {
  async generateRecipes(input: AIGenerationInput): Promise<RecipeSearchResult[]> {
    try {
      const results = await generateRecipesFromIntent(input.query, input.intent, input.count);
      return results as unknown as RecipeSearchResult[];
    } catch {
      // Graceful degrade — never let an AI failure surface to the caller
      return generateFallbackRecipes(input.intent) as unknown as RecipeSearchResult[];
    }
  },
};
