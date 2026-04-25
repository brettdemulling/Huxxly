import type { FlowResult } from '@/lib/core/canonicalModels';
import { parseIntent, generateMeals, deduplicateIngredients } from '@/lib/orchestrator/flowEngine';
import { findNearbyStores } from '@/lib/geo/storeLocator';
import { buildOptimalCart } from '@/lib/engines/cartEngine';
import { rankStoresByZipCoverage, filterByMinCoverage } from '@/lib/geo/coverageEngine';
import { getAdapter } from '@/lib/adapters';
import { trackEvent } from '@/lib/analytics/checkoutTelemetry';
import { detectDegradationMode, executeDegradedFlow } from '@/lib/resilience/gracefulDegradation';
import { generateFallbackResponse } from '@/lib/resilience/partialSuccess';
import { v4 as uuidv4 } from 'uuid';

const INSTANT_TIMEOUT_MS = 2_800;

export interface InstantFlowResult extends Partial<FlowResult> {
  partial: boolean;
  completedSteps: string[];
  pendingOptimizationFlowId?: string;
  degradationMessage?: string;
}

async function attemptInstantFlow(
  rawInput: string,
  zipCode: string,
  userId: string,
): Promise<InstantFlowResult> {
  const completed: string[] = [];
  const sessionId = `instant:${userId}:${Date.now()}`;

  const intent = await parseIntent(rawInput, zipCode, userId);
  completed.push('intent');

  const meals = await generateMeals(intent, '');
  completed.push('meals');

  const allIngredients = deduplicateIngredients(meals);

  const rawStores = await findNearbyStores(zipCode);
  const ranked = rankStoresByZipCoverage(filterByMinCoverage(rawStores, 0.3), zipCode);
  const primaryStore = ranked[0];
  completed.push('store');

  const { cart } = await buildOptimalCart(allIngredients, primaryStore, userId, intent.budgetCents);
  completed.push('cart');

  trackEvent({
    userId,
    sessionId,
    cartId: cart.id,
    store: cart.provider,
    eventType: 'cart_build_completed',
    timestamp: Date.now(),
    metadata: { totalCost: cart.estimatedTotalCents / 100 },
  });

  const adapter = getAdapter(cart.provider);
  const { checkoutUrl } = await adapter.checkout(cart);
  cart.checkoutUrl = checkoutUrl;
  completed.push('checkout');

  return {
    intent,
    meals,
    carts: [cart],
    primaryCart: cart,
    failoverApplied: false,
    eventIds: [],
    partial: false,
    completedSteps: completed,
  };
}

export async function runInstantFlow(
  rawInput: string,
  zipCode: string,
  userId: string,
): Promise<InstantFlowResult> {
  const pendingOptimizationFlowId = uuidv4();
  const sessionId = `instant:${userId}:${Date.now()}`;

  // Check degradation before spinning up the full pipeline
  const systemHealth = detectDegradationMode();
  const degradedFlow = executeDegradedFlow(systemHealth);

  if (systemHealth.mode === 'CACHED_MEAL_PLAN') {
    const fallback = generateFallbackResponse(systemHealth.mode, systemHealth.degradedProviders);
    trackEvent({
      userId,
      sessionId,
      eventType: 'cart_build_failed',
      timestamp: Date.now(),
      metadata: { error: 'all_circuits_open' },
    });
    return {
      partial: true,
      completedSteps: [],
      pendingOptimizationFlowId,
      degradationMessage: fallback.userMessage,
    };
  }

  const timeout = new Promise<InstantFlowResult>((resolve) =>
    setTimeout(() => {
      trackEvent({
        userId,
        sessionId,
        eventType: 'cart_build_failed',
        timestamp: Date.now(),
        metadata: { error: 'instant_flow_timeout' },
      });
      resolve({
        partial: true,
        completedSteps: [],
        pendingOptimizationFlowId,
        degradationMessage: degradedFlow.message !== 'All systems operational.' ? degradedFlow.message : undefined,
      });
    }, INSTANT_TIMEOUT_MS),
  );

  try {
    return await Promise.race([
      attemptInstantFlow(rawInput, zipCode, userId),
      timeout,
    ]);
  } catch (err) {
    trackEvent({
      userId,
      sessionId,
      eventType: 'cart_build_failed',
      timestamp: Date.now(),
      metadata: { error: err instanceof Error ? err.message : 'unknown' },
    });
    return {
      partial: true,
      completedSteps: [],
      pendingOptimizationFlowId,
    };
  }
}
