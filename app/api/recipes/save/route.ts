import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const SaveSchema = z.object({ recipeId: z.string().min(1) });

// POST /api/recipes/save — save a recipe
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'recipeId required' }, { status: 422 });

  const { recipeId } = parsed.data;
  const userId = session.user.id;

  await prisma.savedRecipe.upsert({
    where: { userId_recipeId: { userId, recipeId } },
    create: { userId, recipeId },
    update: {},
  });

  console.log('[recipeSystem]', { action: 'save', userId });
  return NextResponse.json({ ok: true });
}

// DELETE /api/recipes/save — unsave a recipe
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'recipeId required' }, { status: 422 });

  const { recipeId } = parsed.data;
  const userId = session.user.id;

  await prisma.savedRecipe.deleteMany({ where: { userId, recipeId } });

  console.log('[recipeSystem]', { action: 'unsave', userId });
  return NextResponse.json({ ok: true });
}
