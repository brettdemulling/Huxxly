import type { CartResult } from '@/lib/contracts';

export type CheckoutProvider = 'instacart' | 'kroger' | 'walmart' | 'target' | 'baseline';

export interface CheckoutSession {
  id: string;
  userId: string;
  createdAt: number;
  cart: CartResult;
  provider: CheckoutProvider | null;
  status: 'pending' | 'validating' | 'ready' | 'handed_off' | 'error';
}

export interface OrderDraft {
  sessionId: string;
  provider: CheckoutProvider;
  lineItems: { name: string; estimatedCost: number }[];
  totalCost: number;
  storeId: string | null;
}

export interface ProviderHandoff {
  provider: CheckoutProvider;
  redirectUrl: string;
  externalCartId: string | null;
  expiresAt: number;
}

export function createCheckoutSession(userId: string, cart: CartResult): CheckoutSession {
  return {
    id: `session-${userId}-${Date.now()}`,
    userId,
    createdAt: Date.now(),
    cart,
    provider: null,
    status: 'pending',
  };
}

export function buildOrderDraft(session: CheckoutSession, provider: CheckoutProvider): OrderDraft {
  return {
    sessionId: session.id,
    provider,
    lineItems: session.cart.items.map((i) => ({ name: i.name, estimatedCost: i.estimatedCost })),
    totalCost: session.cart.totalCost,
    storeId: session.cart.storeId ?? null,
  };
}

export function handoffToProvider(draft: OrderDraft): ProviderHandoff {
  // Stub: real implementations delegate to instacart/kroger/walmart/target SDKs
  return {
    provider: draft.provider,
    redirectUrl: `/checkout/confirm?session=${draft.sessionId}&provider=${draft.provider}`,
    externalCartId: null,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
}
