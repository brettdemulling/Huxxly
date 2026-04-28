import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

interface GroceryItem {
  name: string;
  estimatedCost: number;
}

// GET /api/recipes/cart — aggregate grocery cart from saved recipes
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const saved = await prisma.savedRecipe.findMany({
    where: { userId },
    include: { recipe: true },
  });

  if (!saved.length) {
    console.log('[recipeSystem]', { action: 'cart', userId });
    return NextResponse.json({ items: [], totalCost: 0, recipeCount: 0 });
  }

  const items: GroceryItem[] = saved.map((s) => ({
    name: s.recipe.name,
    estimatedCost: s.recipe.price,
  }));

  const totalCost = parseFloat(
    items.reduce((sum, i) => sum + i.estimatedCost, 0).toFixed(2),
  );

  console.log('[recipeSystem]', { action: 'cart', userId });
  return NextResponse.json({ items, totalCost, recipeCount: saved.length });
}
