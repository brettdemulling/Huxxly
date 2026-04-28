import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

// GET /api/mealplan — list user's meal plans
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const plans = await prisma.mealPlan.findMany({
    where: { userId: session.user.id },
    include: {
      items: {
        include: { recipe: true },
        orderBy: { day: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ plans });
}
