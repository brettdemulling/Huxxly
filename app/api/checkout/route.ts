import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { validateAndParse } from '@/lib/security/sanitize';
import { CheckoutInputSchema, CartCanonical } from '@/lib/core/canonicalModels';
import { getAdapter } from '@/lib/adapters';
import { logEvent } from '@/lib/events/eventLogger';
import { metrics } from '@/lib/monitoring/metrics';

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, 'checkout');
  if (rateLimitResponse) return rateLimitResponse;

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let parsed: { cartId: string; intentId: string };
  try {
    parsed = validateAndParse(CheckoutInputSchema, body);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Validation failed' }, { status: 422 });
  }

  // Cart is passed directly from the client state after flow engine ran
  // In production this would be fetched from DB by cartId
  const cart = (body as { cart?: CartCanonical }).cart;
  if (!cart) {
    return NextResponse.json({ error: 'Cart data required' }, { status: 400 });
  }

  // Validate cart integrity before checkout
  if (!cart.items?.length) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  try {
    const adapter = getAdapter(cart.provider);
    const { checkoutUrl, cartId } = await adapter.checkout(cart);

    await logEvent('checkout_triggered', session.user.id, {
      cartId,
      provider: cart.provider,
      checkoutUrl,
      totalCents: cart.estimatedTotalCents,
      itemCount: cart.items.length,
    });

    metrics.increment('checkout_success', { provider: cart.provider });

    return NextResponse.json({ checkoutUrl, cartId });
  } catch (err) {
    metrics.failure('/api/checkout', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
