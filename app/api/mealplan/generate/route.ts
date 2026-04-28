import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const GenerateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

// POST /api/mealplan/generate — distribute saved recipes across 7 days
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = GenerateSchema.safeParse(body);
  const planName = parsed.success && parsed.data.name
    ? parsed.data.name
    : `Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const userId = session.user.id;

  const saved = await prisma.savedRecipe.findMany({
    where: { userId },
    include: { recipe: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!saved.length) {
    return NextResponse.json({ error: 'No saved recipes. Save recipes first.' }, { status: 400 });
  }

  // Round-robin distribute saved recipes across 7 days
  const items = DAYS.map((day, i) => ({
    day,
    recipeId: saved[i % saved.length].recipeId,
  }));

  const plan = await prisma.mealPlan.create({
    data: {
      userId,
      name: planName,
      items: {
        create: items,
      },
    },
    include: {
      items: { include: { recipe: true } },
    },
  });

  console.log('[recipeSystem]', { action: 'mealplan', userId });
  return NextResponse.json({ plan });
}
