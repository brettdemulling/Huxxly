import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/orchestration/commerceOrchestrator';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { generateFallbackRecipes } from '@/lib/ai/generateFallbackRecipes';
import { toRecipeViewModel } from '@/lib/view-models/recipeViewModel';

// GET /api/recipes?q=pasta&limit=20
// Returns RecipeViewModel[] — frontend must never consume raw DB or AI objects.
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q') ?? '';
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20'), 50);

    const { results, meta } = await search(q, limit);

    const session = await getSession(request);
    let savedSet = new Set<string>();
    if (session) {
      const saved = await prisma.savedRecipe.findMany({
        where: { userId: session.user.id },
        select: { recipeId: true },
      });
      savedSet = new Set(saved.map((s) => s.recipeId));
    }

    const viewModels = results.map((r) => toRecipeViewModel(r, savedSet.has(r.id)));

    return NextResponse.json({
      results: viewModels,
      // Keep `recipes` alias for any client code still using the old field name
      recipes: viewModels,
      meta: {
        dbCount: meta.dbCount,
        aiCount: meta.aiCount,
        fallbackUsed: meta.fallbackUsed,
        totalCount: meta.totalCount,
        estimatedTotal: meta.estimatedTotal,
        servings: meta.servings,
        budgetTotal: meta.budgetTotal,
        isServingQuery: meta.isServingQuery,
        isBudgeted: meta.isBudgeted,
        dietTags: meta.dietTags,
        intentFlags: meta.intentFlags,
      },
    });
  } catch {
    const fallback = generateFallbackRecipes({ dietTags: [], intentFlags: [] });
    const viewModels = fallback.map((r) =>
      toRecipeViewModel({ ...r, adjustedPrice: r.price, score: 0, source: 'fallback' as const }, false),
    );
    return NextResponse.json({
      results: viewModels,
      recipes: viewModels,
      meta: null,
    });
  }
}
