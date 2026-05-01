import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { getStoresByZip, BASELINE_STORE } from '@/lib/stores/getStoresByZip';

interface GroceryItem {
  name: string;
  estimatedCost: number;
}

// GET /api/recipes/cart
// Optional query params:
//   ?zipCode=37067            → returns stores list + baseline cart
//   ?zipCode=37067&storeId=X  → applies store's priceMultiplier to all items
// No params → existing behavior (backward compat)
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const zipCode = request.nextUrl.searchParams.get('zipCode') ?? '';
  const storeId = request.nextUrl.searchParams.get('storeId') ?? '';

  const saved = await prisma.savedRecipe.findMany({
    where: { userId },
    include: { recipe: true },
  });

  if (!saved.length) {
    console.log('[recipeSystem]', { action: 'cart', userId });
    return NextResponse.json({ items: [], totalCost: 0, recipeCount: 0 });
  }

  // Base items at recipe price (no store adjustment)
  const baseItems: GroceryItem[] = saved.map((s) => ({
    name: s.recipe.name,
    estimatedCost: s.recipe.price,
  }));

  // ── No store params — existing behavior (backward compat) ─────────────────
  if (!zipCode) {
    const totalCost = parseFloat(
      baseItems.reduce((sum, i) => sum + i.estimatedCost, 0).toFixed(2),
    );
    console.log('[recipeSystem]', { action: 'cart', userId });
    return NextResponse.json({ items: baseItems, totalCost, recipeCount: saved.length });
  }

  // ── Multi-store mode ───────────────────────────────────────────────────────
  const stores = getStoresByZip(zipCode);
  const selectedStore = stores.find((s) => s.id === storeId) ?? stores[0] ?? BASELINE_STORE;

  // Compute cart for every store (for price comparison display)
  const storesCarts = stores.map((store) => {
    const items = baseItems.map((item) => ({
      name: item.name,
      adjustedCost: parseFloat((item.estimatedCost * store.priceMultiplier).toFixed(2)),
    }));
    const totalCost = parseFloat(
      items.reduce((sum, i) => sum + i.adjustedCost, 0).toFixed(2),
    );
    return { storeId: store.id, storeName: store.name, priceMultiplier: store.priceMultiplier, items, totalCost };
  });

  const selectedCart = storesCarts.find((s) => s.storeId === selectedStore.id) ?? storesCarts[0];

  // Map back to existing GroceryItem shape for the top-level fields (backward compat)
  const selectedItems: GroceryItem[] = selectedCart.items.map((i) => ({
    name: i.name,
    estimatedCost: i.adjustedCost,
  }));

  console.log('[recipeSystem]', { action: 'cart', userId, zipCode, storeId: selectedStore.id });
  return NextResponse.json({
    // Backward-compat top-level fields (reflect selected store)
    items: selectedItems,
    totalCost: selectedCart.totalCost,
    recipeCount: saved.length,
    // Multi-store extension fields
    storeId: selectedStore.id,
    storeName: selectedStore.name,
    stores: storesCarts,
  });
}
