import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { cart } from '@/lib/orchestration/commerceOrchestrator';

// GET /api/recipes/cart
// Optional query params:
//   ?zipCode=37067            → returns stores list + store-adjusted cart
//   ?zipCode=37067&storeId=X  → applies specific store's priceMultiplier
// No params → baseline pricing (backward compat)
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const zipCode = request.nextUrl.searchParams.get('zipCode') ?? '';
  const storeId = request.nextUrl.searchParams.get('storeId') ?? '';

  const result = await cart(userId, zipCode || undefined, storeId || undefined);

  if (!result.items.length) {
    console.log('[recipeSystem]', { action: 'cart', userId });
    return NextResponse.json({ items: [], totalCost: 0, recipeCount: 0 });
  }

  console.log('[recipeSystem]', { action: 'cart', userId, zipCode, storeId: result.storeId });
  return NextResponse.json(result);
}
