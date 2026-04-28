import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const SwapSchema = z.object({
  fromRecipeId: z.string().min(1),
  toRecipeId: z.string().min(1),
});

// POST /api/recipes/swap — replace one saved recipe with another
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SwapSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'fromRecipeId and toRecipeId required' }, { status: 422 });

  const { fromRecipeId, toRecipeId } = parsed.data;
  const userId = session.user.id;

  const toRecipe = await prisma.recipe.findUnique({ where: { id: toRecipeId } });
  if (!toRecipe) return NextResponse.json({ error: 'Target recipe not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.savedRecipe.deleteMany({ where: { userId, recipeId: fromRecipeId } }),
    prisma.savedRecipe.upsert({
      where: { userId_recipeId: { userId, recipeId: toRecipeId } },
      create: { userId, recipeId: toRecipeId },
      update: {},
    }),
  ]);

  console.log('[recipeSystem]', { action: 'swap', userId });
  return NextResponse.json({ ok: true, swappedTo: toRecipe });
}
