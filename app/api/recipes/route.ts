import { NextRequest, NextResponse } from 'next/server';
import { searchRecipes } from '@/lib/search/searchEngine';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { generateFallbackRecipes } from '@/lib/ai/generateFallbackRecipes';

// GET /api/recipes?q=pasta&limit=20
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q') ?? '';
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20'), 50);

    const { results, meta } = await searchRecipes(q, limit);

    // Attach saved status if user is authenticated
    const session = await getSession(request);
    if (session) {
      const saved = await prisma.savedRecipe.findMany({
        where: { userId: session.user.id },
        select: { recipeId: true },
      });
      const savedSet = new Set(saved.map((s) => s.recipeId));
      return NextResponse.json({
        recipes: results.map((r) => ({ ...r, isSaved: savedSet.has(r.id) })),
        meta,
      });
    }

    return NextResponse.json({
      recipes: results.map((r) => ({ ...r, isSaved: false })),
      meta,
    });
  } catch {
    const fallback = generateFallbackRecipes({ dietTags: [], intentFlags: [] });
    return NextResponse.json({ recipes: fallback.map((r) => ({ ...r, isSaved: false })), meta: null });
  }
}
