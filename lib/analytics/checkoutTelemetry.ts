import { prisma } from '@/lib/db';

export type CheckoutEventType =
  | 'checkout_attempt_started'
  | 'checkout_attempt_success'
  | 'checkout_attempt_failed'
  | 'store_fallback_triggered'
  | 'cart_build_completed'
  | 'cart_build_failed';

export type CheckoutEvent = {
  userId: string;
  sessionId?: string;
  store?: string;
  cartId?: string;
  eventType: CheckoutEventType;
  timestamp: number;
  metadata?: {
    totalCost?: number;
    savings?: number;
    error?: string;
    fallbackStore?: string;
  };
};

export interface TimeRange {
  hours: number;
}

export interface CheckoutMetrics {
  attempts: number;
  successRate: number;
  fallbackRate: number;
  cartCompletionRate: number;
}

type PrismaJson = Parameters<typeof prisma.event.create>[0]['data']['payload'];

function fireAndForget(fn: () => Promise<unknown>): void {
  void fn().catch(() => {});
}

export function trackEvent(event: CheckoutEvent): void {
  fireAndForget(async () => {
    await prisma.event.create({
      data: {
        type: event.eventType,
        userId: event.userId,
        payload: {
          sessionId: event.sessionId,
          store: event.store,
          cartId: event.cartId,
          timestamp: event.timestamp,
          ...event.metadata,
        } as unknown as PrismaJson,
      },
    });
  });
}

export function computeSuccessRate(successes: number, attempts: number): number {
  if (attempts === 0) return 0;
  return parseFloat((successes / attempts).toFixed(4));
}

export function computeFallbackRate(fallbacks: number, attempts: number): number {
  if (attempts === 0) return 0;
  return parseFloat((fallbacks / attempts).toFixed(4));
}

export function computeCartCompletionRate(completed: number, total: number): number {
  if (total === 0) return 0;
  return parseFloat((completed / total).toFixed(4));
}

export async function getCheckoutMetrics(timeRange: TimeRange = { hours: 24 }): Promise<CheckoutMetrics> {
  try {
    const since = new Date(Date.now() - timeRange.hours * 3_600_000);

    const [attempts, successes, fallbacks, cartBuilds, cartCompleted] = await Promise.all([
      prisma.event.count({ where: { type: 'checkout_attempt_started', timestamp: { gte: since } } }),
      prisma.event.count({ where: { type: 'checkout_attempt_success', timestamp: { gte: since } } }),
      prisma.event.count({ where: { type: 'store_fallback_triggered', timestamp: { gte: since } } }),
      prisma.event.count({ where: { type: { in: ['cart_build_completed', 'cart_build_failed'] }, timestamp: { gte: since } } }),
      prisma.event.count({ where: { type: 'cart_build_completed', timestamp: { gte: since } } }),
    ]);

    return {
      attempts,
      successRate: computeSuccessRate(successes, attempts),
      fallbackRate: computeFallbackRate(fallbacks, attempts),
      cartCompletionRate: computeCartCompletionRate(cartCompleted, cartBuilds),
    };
  } catch {
    return { attempts: 0, successRate: 0, fallbackRate: 0, cartCompletionRate: 0 };
  }
}
