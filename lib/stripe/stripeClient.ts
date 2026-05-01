/**
 * Stripe REST client — no SDK required.
 * Uses the Stripe v1 API via fetch with URL-encoded form bodies.
 * Webhook verification uses Node.js built-in crypto (HMAC-SHA256).
 */
import { createHmac, timingSafeEqual } from 'crypto';

const STRIPE_API = 'https://api.stripe.com/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StripeLineItem {
  name: string;
  description?: string;
  amountCents: number;
  quantity?: number;
}

export interface CreateSessionParams {
  lineItems: StripeLineItem[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface StripeSession {
  id: string;
  url: string;
  payment_status: string;
  amount_total: number;
  currency: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

// ─── Form encoder (Stripe uses x-www-form-urlencoded with bracket notation) ──

function encodeValue(value: unknown, key: string, pairs: [string, string][]): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => encodeValue(v, `${key}[${i}]`, pairs));
  } else if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) =>
      encodeValue(v, `${key}[${k}]`, pairs),
    );
  } else {
    pairs.push([key, String(value)]);
  }
}

function toStripeBody(params: Record<string, unknown>): string {
  const pairs: [string, string][] = [];
  Object.entries(params).forEach(([k, v]) => encodeValue(v, k, pairs));
  return pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return key;
}

async function stripePost<T>(path: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toStripeBody(params),
    cache: 'no-store',
  });

  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const errMsg = (json.error as { message?: string })?.message ?? res.statusText;
    throw new Error(`Stripe API error (${res.status}): ${errMsg}`);
  }
  return json as T;
}

// ─── Checkout session creation ────────────────────────────────────────────────

export async function createCheckoutSession(params: CreateSessionParams): Promise<StripeSession> {
  const lineItems = params.lineItems.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
      },
      unit_amount: Math.round(item.amountCents),
    },
    quantity: item.quantity ?? 1,
  }));

  const payload: Record<string, unknown> = {
    mode: 'payment',
    line_items: lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };

  return stripePost<StripeSession>('/checkout/sessions', payload);
}

// ─── Webhook signature verification (HMAC-SHA256, no SDK) ────────────────────

/**
 * Verifies the `Stripe-Signature` header against the raw request body.
 * Stripe signed payload format: `{t}.{rawBody}`
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
): boolean {
  try {
    const parts = signatureHeader.split(',');
    const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
    const v1Signatures = parts
      .filter((p) => p.startsWith('v1='))
      .map((p) => p.slice(3));

    if (!timestamp || v1Signatures.length === 0) return false;

    // Reject signatures older than 5 minutes to prevent replay attacks
    const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (age > 300) return false;

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    return v1Signatures.some((sig) => {
      try {
        const sigBuf = Buffer.from(sig, 'hex');
        if (sigBuf.length !== expectedBuf.length) return false;
        return timingSafeEqual(expectedBuf, sigBuf);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function parseWebhookEvent(rawBody: string): StripeWebhookEvent {
  return JSON.parse(rawBody) as StripeWebhookEvent;
}

export function stripeIsConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
