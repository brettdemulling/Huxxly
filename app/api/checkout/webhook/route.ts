import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyWebhookSignature, parseWebhookEvent } from '@/lib/stripe/stripeClient';

// Stripe requires the raw request body for HMAC signature verification.
// In Next.js App Router we use request.text() to read the unparsed body.
// This route must NOT parse the body as JSON before signature verification.

// POST /api/checkout/webhook
// Receives Stripe events and updates Order status.
// All payment confirmation comes from Stripe webhooks ONLY — never from client.
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe-Signature header' }, { status: 400 });
  }

  const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    console.log('[commerce]', { action: 'order', source: 'stripe', success: false, reason: 'invalid_signature' });
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  let event: ReturnType<typeof parseWebhookEvent>;
  try {
    event = parseWebhookEvent(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed webhook payload' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const obj = event.data.object;
        const stripeSessionId = obj.id as string;
        const paymentIntent = (obj.payment_intent as string | null) ?? null;
        const amountTotal = (obj.amount_total as number | null) ?? 0;
        const paymentStatus = obj.payment_status as string;

        // Only mark complete if payment actually succeeded
        if (paymentStatus === 'paid') {
          await prisma.order.updateMany({
            where: { stripeSessionId },
            data: {
              status: 'complete',
              stripePaymentIntent: paymentIntent,
              amountTotal,
            },
          });

          console.log('[commerce]', {
            action: 'order',
            source: 'stripe',
            success: true,
            event: 'checkout.session.completed',
            stripeSessionId,
            amountTotal,
          });
        } else {
          // Payment pending (e.g. bank redirect) — leave as pending
          console.log('[commerce]', {
            action: 'order',
            source: 'stripe',
            success: false,
            event: 'checkout.session.completed',
            paymentStatus,
            reason: 'payment_not_yet_captured',
          });
        }
        break;
      }

      case 'checkout.session.expired': {
        const stripeSessionId = event.data.object.id as string;
        await prisma.order.updateMany({
          where: { stripeSessionId, status: 'pending' },
          data: { status: 'failed' },
        });
        console.log('[commerce]', { action: 'order', source: 'stripe', success: false, event: 'checkout.session.expired' });
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object.id as string;
        await prisma.order.updateMany({
          where: { stripePaymentIntent: pi, status: 'pending' },
          data: { status: 'failed' },
        });
        console.log('[commerce]', { action: 'order', source: 'stripe', success: false, event: 'payment_intent.payment_failed' });
        break;
      }

      case 'charge.refunded': {
        const pi = (event.data.object as { payment_intent?: string }).payment_intent ?? null;
        if (pi) {
          await prisma.order.updateMany({
            where: { stripePaymentIntent: pi },
            data: { status: 'refunded' },
          });
        }
        console.log('[commerce]', { action: 'order', source: 'stripe', success: true, event: 'charge.refunded' });
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt, do nothing
        break;
    }
  } catch (err) {
    console.log('[commerce]', {
      action: 'order',
      source: 'stripe',
      success: false,
      event: event.type,
      error: err instanceof Error ? err.message : 'unknown',
    });
    // Return 500 so Stripe retries the webhook
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
