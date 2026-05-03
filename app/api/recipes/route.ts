import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/orchestration/commerceOrchestrator';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { generateFallbackRecipes } from '@/lib/ai/generateFallbackRecipes';
import { toRecipeViewModel } from '@/lib/view-models/recipeViewModel';

// GET /api/recipes?q=pasta&limit=20&servings=4&diet=vegan,gluten-free
// Returns RecipeViewModel[] — frontend must never consume raw DB or AI objects.
export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const sp = request.nextUrl.searchParams;
    const q = sp.get('q') ?? '';
    const limit = Math.min(parseInt(sp.get('limit') ?? '20'), 50);

    // Merge diet filters into query so the intent parser picks them up
    const dietParam = sp.get('diet') ?? '';
    const effectiveQuery = dietParam ? `${q} ${dietParam}`.trim() : q;

    const { results, meta } = await search(effectiveQuery, limit);

    // Serving adjustment — if ?servings= is passed separate from the query text
    const servingsParam = sp.get('servings');
    const requestedServings = servingsParam ? parseInt(servingsParam) : null;

    const session = await getSession(request);
    let savedSet = new Set<string>();
    if (session) {
      const saved = await prisma.savedRecipe.findMany({
        where: { userId: session.user.id },
        select: { recipeId: true },
      });
      savedSet = new Set(saved.map((s) => s.recipeId));
    }

    // Apply serving override to adjustedPrice if passed separately
    const viewModels = results.map((r) => {
      const isSaved = savedSet.has(r.id);
      if (requestedServings && !meta.isServingQuery) {
        const base = r.servings ?? 4;
        const adjustedPrice = parseFloat(((r.price / base) * requestedServings).toFixed(2));
        return toRecipeViewModel(
          { ...r, adjustedPrice, displayServings: requestedServings },
          isSaved,
        );
      }
      return toRecipeViewModel(r, isSaved);
    });

    const latencyMs = Date.now() - start;

    return NextResponse.json({
      results: viewModels,
      recipes: viewModels, // alias for backward compat
      meta: {
        dbCount: meta.dbCount,
        mealdbCount: meta.mealdbCount,
        aiCount: meta.aiCount,
        fallbackUsed: meta.fallbackUsed,
        totalCount: meta.totalCount,
        estimatedTotal: meta.estimatedTotal,
        servings: meta.servings ?? requestedServings,
        budgetTotal: meta.budgetTotal,
        isServingQuery: meta.isServingQuery || !!requestedServings,
        isBudgeted: meta.isBudgeted,
        dietTags: meta.dietTags,
        intentFlags: meta.intentFlags,
        latencyMs,
        cacheHit: false, // cache hit reporting handled in domain layer telemetry
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
      meta: {
        dbCount: 0, mealdbCount: 0, aiCount: 0, fallbackUsed: true,
        totalCount: viewModels.length, estimatedTotal: 0,
        servings: null, budgetTotal: null, isServingQuery: false,
        isBudgeted: false, dietTags: [], intentFlags: [],
        latencyMs: Date.now() - start, cacheHit: false,
      },
    });
  }
}
