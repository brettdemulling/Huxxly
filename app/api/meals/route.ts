import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { prisma } from '@/lib/db';
import { recordAcceptedMeals } from '@/lib/memory/memoryEngine';
import { logEvent } from '@/lib/events/eventLogger';
import { MealCanonical } from '@/lib/core/canonicalModels';
import { z } from 'zod';

const ApproveSchema = z.object({
  intentId: z.string(),
  meals: z.array(z.any()),
});

// GET /api/meals?intentId=xxx — retrieve meals for an intent
export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, 'meals');
  if (rateLimitResponse) return rateLimitResponse;

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const intentId = request.nextUrl.searchParams.get('intentId');
  if (!intentId) return NextResponse.json({ error: 'intentId required' }, { status: 400 });

  const meals = await prisma.meal.findMany({
    where: { intentId, intent: { userId: session.user.id } },
  });

  return NextResponse.json({ meals });
}

// POST /api/meals — approve meals and persist
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, 'meals');
  if (rateLimitResponse) return rateLimitResponse;

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 422 });
  }

  const { intentId, meals } = parsed.data;

  // Persist approved meals
  await prisma.meal.createMany({
    data: meals.map((m: MealCanonical) => ({
      id: m.id,
      intentId,
      name: m.name,
      description: m.description,
      servings: m.servings,
      prepTimeMinutes: m.prepTimeMinutes,
      cookTimeMinutes: m.cookTimeMinutes,
      dietaryFlags: m.dietaryFlags,
      estimatedCostCents: m.estimatedCostCents,
      ingredientsJson: m.ingredients,
      approved: true,
    })),
    skipDuplicates: true,
  });

  await recordAcceptedMeals(session.user.id, meals as MealCanonical[]);
  await logEvent('meals_generated', session.user.id, { intentId, approved: meals.length });

  return NextResponse.json({ ok: true });
}
