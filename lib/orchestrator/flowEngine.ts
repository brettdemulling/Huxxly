import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { Intent, MealCanonical, FlowResult, IngredientCanonical } from '@/lib/core/canonicalModels';
import { getMemoryProfile, recordIntent, buildMemoryContext } from '@/lib/memory/memoryEngine';
import * as cache from '@/lib/cache/cacheGateway';
import { findNearbyStores } from '@/lib/geo/storeLocator';
import { rankStoresByZipCoverage, filterByMinCoverage } from '@/lib/geo/coverageEngine';
import { resolveGeoEdgeCases } from '@/lib/geo/geoEdgeHandler';
import { buildOptimalCart } from '@/lib/engines/cartEngine';
import { withFailover } from './failoverEngine';
import { runWithCheckpoint, clearCheckpoints } from './checkpointManager';
import { logEvent } from '@/lib/events/eventLogger';
import { normalizeError, withErrorBoundary } from '@/lib/errors/errorHandler';
import { metrics, withLatency } from '@/lib/monitoring/metrics';
import { startTrace, withSpan, finalizeTrace } from '@/lib/monitoring/tracing';
import { buildPromptMessage, validateResponse, getCallParams } from '@/lib/ai/promptRegistry';
import { prisma } from '@/lib/db';
import { estimateAlternativeCartCost, optimizePrice } from '@/lib/optimization/priceOptimizer';
import { computeFlowConfidence } from '@/lib/core/confidenceEngine';
import { computeTrust } from '@/lib/trust/trustEngine';
import { runAutopilot } from '@/lib/autopilot/autopilotEngine';
import { buildSavingsData } from '@/lib/analytics/savingsEngine';
import { markPending } from '@/lib/safety/undoEngine';
import { detectRepeatPattern } from '@/lib/recommendation/repeatEngine';
import { runtime } from '@/lib/config/runtime';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// ─── Step 1: Parse intent (versioned prompt) ──────────────────────────────────

export async function parseIntent(rawInput: string, zip: string, userId: string): Promise<Intent> {
  if (!runtime.isAIEnabled) {
    throw new Error('AI service unavailable: ANTHROPIC_API_KEY not configured.');
  }
  const { model, maxTokens, system } = getCallParams('intent_parse');
  const message = buildPromptMessage('intent_parse', { input: rawInput });

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: message }],
  });

  metrics.aiCost(model, response.usage.input_tokens, response.usage.output_tokens);

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  const parsed = validateResponse('intent_parse', textBlock?.text ?? '{}', {
    budgetCents: 12000,
    servings: 4,
    mealCount: 5,
    dietaryFlags: [] as string[],
  });

  return {
    id: uuidv4(),
    userId,
    rawInput,
    budgetCents: parsed.budgetCents,
    zipCode: zip,
    servings: parsed.servings,
    dietaryFlags: parsed.dietaryFlags,
    mealCount: parsed.mealCount,
    createdAt: new Date().toISOString(),
  };
}

// ─── Step 2: Generate meals (versioned prompt + cache) ────────────────────────

export async function generateMeals(
  intent: Intent,
  memoryContext: string,
): Promise<MealCanonical[]> {
  if (!runtime.isAIEnabled) {
    throw new Error('AI service unavailable: ANTHROPIC_API_KEY not configured.');
  }
  const cached = await cache.getMealPlan(intent.id);
  if (cached) {
    return JSON.parse(cached as string) as MealCanonical[];
  }

  const { model, maxTokens } = getCallParams('meal_generation');
  const message = buildPromptMessage('meal_generation', {
    mealCount: intent.mealCount,
    budgetCents: intent.budgetCents,
    servings: intent.servings,
    dietaryFlags: intent.dietaryFlags.join(', '),
    zipCode: intent.zipCode,
    memoryContext,
  });

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: message }],
  });

  metrics.aiCost(model, response.usage.input_tokens, response.usage.output_tokens);

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  const rawMeals = validateResponse('meal_generation', textBlock?.text ?? '[]', []);

  const meals: MealCanonical[] = (Array.isArray(rawMeals) ? rawMeals : []).map((m: {
    name?: string; description?: string; servings?: number; prepTimeMinutes?: number;
    cookTimeMinutes?: number; dietaryFlags?: string[]; estimatedCostCents?: number;
    ingredients?: Array<{ name?: string; category?: string; quantity?: number; unit?: string; estimatedCostCents?: number; substitutes?: string[] }>;
  }) => ({
    id: uuidv4(),
    name: m.name ?? 'Unnamed Meal',
    description: m.description ?? '',
    servings: m.servings ?? intent.servings,
    prepTimeMinutes: m.prepTimeMinutes ?? 15,
    cookTimeMinutes: m.cookTimeMinutes ?? 30,
    dietaryFlags: m.dietaryFlags ?? [],
    estimatedCostCents: m.estimatedCostCents ?? 2000,
    sharedIngredientCount: 0,
    ingredients: (m.ingredients ?? []).map((i) => ({
      id: uuidv4(),
      name: i.name ?? '',
      normalizedName: (i.name ?? '').toLowerCase().replace(/\s+/g, '_'),
      category: i.category ?? 'other',
      quantity: i.quantity ?? 1,
      unit: i.unit ?? 'item',
      estimatedCostCents: i.estimatedCostCents ?? 200,
      dietaryFlags: [],
      substitutes: i.substitutes ?? [],
    })),
  }));

  await cache.setMealPlan(intent.id, meals, intent.userId);
  return meals;
}

// ─── Step 3: Deduplicate ingredients ─────────────────────────────────────────

export function deduplicateIngredients(meals: MealCanonical[]): IngredientCanonical[] {
  const seen = new Map<string, IngredientCanonical>();
  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      const k = ing.normalizedName;
      if (!seen.has(k)) {
        seen.set(k, ing);
      } else {
        const existing = seen.get(k)!;
        seen.set(k, { ...existing, quantity: existing.quantity + ing.quantity });
      }
    }
  }
  return Array.from(seen.values());
}

// ─── Master flow (fully instrumented with checkpoints + tracing) ───────────────

export async function runAutopilotFlow(
  rawInput: string,
  zipCode: string,
  userId: string,
  flowId?: string,
): Promise<FlowResult> {
  const resolvedFlowId = flowId ?? uuidv4();
  const trace = startTrace(userId, '/api/intent');
  const eventIds: string[] = [];

  return withLatency('flow', async () => {
    try {
      // ── MEMORY FETCH ──────────────────────────────────────────────────────
      const memProfile = await withSpan(trace.traceId, 'memory_fetch', async () =>
        withErrorBoundary(() => getMemoryProfile(userId), 'memory_fetch'),
      );
      const memCtx = buildMemoryContext(memProfile);

      // ── INTENT PARSE (with checkpoint) ────────────────────────────────────
      const intent = await withSpan(trace.traceId, 'intent_parse', async () =>
        runWithCheckpoint<Intent>(resolvedFlowId, 'intent_parse', () =>
          withErrorBoundary(() => parseIntent(rawInput, zipCode, userId), 'intent_parse'),
        ),
      );

      await prisma.intent.upsert({
        where: { id: intent.id },
        create: { id: intent.id, userId, rawInput, budgetCents: intent.budgetCents, zipCode, servings: intent.servings, dietaryFlags: intent.dietaryFlags, mealCount: intent.mealCount },
        update: {},
      });
      const e1 = await logEvent('intent_created', userId, { intentId: intent.id, budgetCents: intent.budgetCents, flowId: resolvedFlowId }, zipCode);
      eventIds.push(e1);
      await recordIntent(userId, intent);
      await cache.registerUserIntent(userId, intent.id);

      // ── MEAL GENERATION (with checkpoint) ─────────────────────────────────
      const meals = await withSpan(trace.traceId, 'meal_generation', async () =>
        runWithCheckpoint<MealCanonical[]>(resolvedFlowId, 'meal_generation', () =>
          withLatency('meals', () =>
            withErrorBoundary(() => generateMeals(intent, memCtx), 'meal_generation'),
          ),
        ),
      );
      const e2 = await logEvent('meals_generated', userId, { intentId: intent.id, count: meals.length }, zipCode);
      eventIds.push(e2);

      // ── NORMALIZATION ─────────────────────────────────────────────────────
      const allIngredients = deduplicateIngredients(meals);

      // ── GEO FILTER + EDGE CASE HANDLING (with checkpoint) ─────────────────
      const geoResult = await withSpan(trace.traceId, 'geo_filter', async (span) => {
        return runWithCheckpoint(resolvedFlowId, 'geo_filter', async () => {
          const rawStores = await findNearbyStores(zipCode);
          const resolution = await resolveGeoEdgeCases(zipCode, rawStores);
          if (resolution.fallbackApplied) {
            span.attributes.geoFallback = true;
            span.attributes.resolvedZip = resolution.resolvedZip;
          }
          return {
            stores: resolution.viableStores,
            resolvedZip: resolution.resolvedZip,
            edgeCase: resolution.edgeCaseDetected,
          };
        });
      });

      const rankedStores = rankStoresByZipCoverage(
        filterByMinCoverage(geoResult.stores, 0.3),
        geoResult.resolvedZip,
      );
      const primaryStore = rankedStores[0];

      // ── INVENTORY + CART + FAILOVER (with checkpoint) ─────────────────────
      const cartResult = await withSpan(trace.traceId, 'cart_build', async (span) => {
        return runWithCheckpoint(resolvedFlowId, 'cart_build', async () => {
          const { result, provider, failoverApplied } = await withFailover(
            { userId, zipCode: geoResult.resolvedZip, currentProvider: primaryStore.provider },
            async (activeProvider) => {
              const store = rankedStores.find((s) => s.provider === activeProvider) ?? {
                ...primaryStore,
                provider: activeProvider,
              };
              return buildOptimalCart(
                allIngredients,
                store,
                userId,
                intent.budgetCents,
                memProfile.rejectedSubstitutions,
              );
            },
          );
          span.attributes.provider = provider;
          span.attributes.failoverApplied = failoverApplied;
          return { ...result, failoverApplied };
        });
      });

      // ── CHECKOUT GENERATION ───────────────────────────────────────────────
      const adapter = await import('@/lib/adapters').then((m) => m.getAdapter(cartResult.cart.provider));
      const { checkoutUrl } = await adapter.checkout(cartResult.cart);
      cartResult.cart.checkoutUrl = checkoutUrl;

      const e3 = await logEvent('checkout_triggered', userId, {
        cartId: cartResult.cart.id,
        provider: cartResult.cart.provider,
        checkoutUrl,
        totalCents: cartResult.cart.estimatedTotalCents,
        flowId: resolvedFlowId,
      }, zipCode);
      eventIds.push(e3);

      // ── CLEAR CHECKPOINTS on success ──────────────────────────────────────
      await clearCheckpoints(resolvedFlowId).catch(() => {});

      // ── ENRICHMENT (price optimization, confidence, trust, savings, undo) ─
      const walmartAlt = estimateAlternativeCartCost(cartResult.cart, 0.08);
      const krogerAlt = estimateAlternativeCartCost(cartResult.cart, 0.14);
      const allCarts = [cartResult.cart, walmartAlt, krogerAlt];
      const { priceBreakdown, priceVariancePercent } = optimizePrice(allCarts);

      const { score: confidenceScore } = computeFlowConfidence(intent, meals, cartResult.cart);
      const { trustScore } = computeTrust(cartResult.cart);
      const { explanation: autopilotExplanation } = runAutopilot(
        intent, meals, cartResult.cart, priceVariancePercent,
      );

      const [savingsData, undoToken] = await Promise.all([
        buildSavingsData(userId, cartResult.cart, [walmartAlt, krogerAlt], zipCode).catch(() => undefined),
        markPending({ intent, meals, carts: allCarts, primaryCart: cartResult.cart, failoverApplied: cartResult.failoverApplied ?? false, eventIds }).catch(() => undefined),
      ]);

      detectRepeatPattern(userId, intent).catch(() => {});

      finalizeTrace(trace.traceId);

      return {
        intent,
        meals,
        carts: [cartResult.cart],
        primaryCart: cartResult.cart,
        failoverApplied: cartResult.failoverApplied ?? false,
        eventIds,
        priceBreakdown,
        autopilotExplanation,
        savingsData,
        confidenceScore,
        trustScore,
        undoToken,
      };
    } catch (err) {
      finalizeTrace(trace.traceId);
      const normalized = normalizeError(err, 'flow');
      await logEvent('error_occurred', userId, {
        flowId: resolvedFlowId,
        error: normalized.message,
        type: normalized.type,
        step: normalized.step,
        recoverable: normalized.recoverable,
      }, zipCode);
      throw err;
    }
  });
}
