import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { createCheckoutSession, stripeIsConfigured } from '@/lib/stripe/stripeClient';
import { z } from 'zod';

const SessionRequestSchema = z.object({
  recipeIds: z.array(z.string().min(1)).min(1).max(50),
  servings: z.number().int().min(1).max(20).optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// POST /api/checkout/session
// Creates a Stripe checkout session from saved recipe IDs.
// Prices are read from the database — never from client submission.
export async function POST(request: NextRequest) {
  if (!stripeIsConfigured()) {
    return NextResponse.json(
      { error: 'Payment processing is not configured on this server' },
      { status: 503 },
    );
  }

  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 });
  }

  const { recipeIds, servings, successUrl, cancelUrl } = parsed.data;
  const userId = session.user.id;

  // Look up real prices from the database — never trust client prices
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
  });

  if (recipes.length === 0) {
    return NextResponse.json({ error: 'No valid recipes found' }, { status: 404 });
  }

  const lineItems = recipes.map((r) => {
    const baseServings = r.servings ?? 4;
    const targetServings = servings ?? baseServings;
    const adjustedPrice =
      targetServings === baseServings
        ? r.price
        : parseFloat(((r.price / baseServings) * targetServings).toFixed(2));
    const amountCents = Math.round(adjustedPrice * 100);

    return {
      name: r.name,
      description: `${r.category} · serves ${targetServings}`,
      amountCents,
      quantity: 1,
    };
  });

  const totalCents = lineItems.reduce((s, i) => s + i.amountCents * (i.quantity ?? 1), 0);

  try {
    const stripeSession = await createCheckoutSession({
      lineItems,
      successUrl,
      cancelUrl,
      metadata: {
        userId,
        recipeIds: recipeIds.join(','),
        servings: String(servings ?? ''),
      },
    });

    // Record the pending order in the database
    await prisma.order.create({
      data: {
        userId,
        stripeSessionId: stripeSession.id,
        status: 'pending',
        amountTotal: totalCents,
        currency: 'usd',
        lineItemsJson: lineItems,
        metadataJson: { recipeIds, servings: servings ?? null },
      },
    });

    console.log('[commerce]', {
      action: 'checkout',
      source: 'stripe',
      success: true,
      userId,
      totalCents,
      recipeCount: recipes.length,
    });

    return NextResponse.json({
      sessionId: stripeSession.id,
      url: stripeSession.url,
    });
  } catch (err) {
    console.log('[commerce]', {
      action: 'checkout',
      source: 'stripe',
      success: false,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 });
  }
}
