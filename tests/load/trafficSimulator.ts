// ─── Traffic Simulator ───────────────────────────────────────────────────────
// Simulates individual virtual user flows with realistic async latency and
// chaos injection. Mirrors the production pipeline without requiring infra:
// intent parse → meal gen → store lookup → cart build → checkout (+ fallback)
// → telemetry (fire-and-forget) → savings write.

import { createChaosInjector, ChaosConfig, ChaosInjector, SimProvider } from './chaosScenarios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VirtualUser {
  userId: string;
  budgetCents: number; // 10_000–15_000 (cents)
  zipCode: string;
  sessionId: string;
}

export interface SimCart {
  id: string;
  provider: SimProvider;
  storeName: string;
  totalCents: number;
  itemCount: number;
  coverageScore: number;
}

export interface SimStore {
  id: string;
  name: string;
  provider: SimProvider;
  compositeScore: number;
  storeId: string | null; // null simulates Instacart null-store chaos
}

export interface UserFlowResult {
  userId: string;
  success: boolean;
  fallbackTriggered: boolean;
  providersAttempted: SimProvider[];
  latencyMs: number;
  error?: string;
  checkoutUrl?: string;
  savingsAmount: number; // in dollars
  telemetryEventsDropped: number;
  telemetryEventsFired: number;
  completedSteps: string[];
}

// ─── Latency profiles (realistic, compressed for test speed) ─────────────────

// TIME_SCALE: 0.05 compresses real latencies by 95% so 60s tests run in ~3s.
// Set to 1.0 for full real-world simulation.
const TIME_SCALE = parseFloat(process.env.STRESS_TIME_SCALE ?? '0.05');

function scaled(ms: number): number {
  return Math.max(1, ms * TIME_SCALE);
}

const LATENCY = {
  intentParse:   (): number => scaled(randBetween(200, 800)),
  mealGenerate:  (): number => scaled(randBetween(500, 2_000)),
  storeLookup:   (): number => scaled(randBetween(50, 200)),
  inventoryCheck:(): number => scaled(randBetween(100, 500)),
  cartBuild:     (): number => scaled(randBetween(200, 600)),
  checkout:      (): number => scaled(randBetween(100, 400)),
  telemetry:     (): number => scaled(randBetween(10, 50)),
  savingsWrite:  (): number => scaled(randBetween(50, 200)),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let _idCounter = 0;
function nextId(): string {
  return `sim-${Date.now()}-${(_idCounter++).toString(36)}`;
}

function fireAndForget(fn: () => Promise<void>): void {
  void fn().catch(() => {});
}

// ─── Simulated pipeline steps ─────────────────────────────────────────────────

async function stepParseIntent(chaos: ChaosInjector): Promise<void> {
  if (chaos.shouldFailGlobally()) throw new Error('Intent: AI API unavailable');
  await sleep(LATENCY.intentParse());
}

async function stepGenerateMeals(
  budgetCents: number,
  chaos: ChaosInjector,
): Promise<{ mealCount: number; estimatedCostCents: number }> {
  if (chaos.shouldFailGlobally()) throw new Error('Meals: generation timed out');
  await sleep(LATENCY.mealGenerate());
  return {
    mealCount: 3 + Math.floor(Math.random() * 4), // 3–6 meals
    estimatedCostCents: Math.round(budgetCents * randBetween(0.72, 0.92)),
  };
}

async function stepFindStores(chaos: ChaosInjector): Promise<SimStore[]> {
  await sleep(LATENCY.storeLookup());
  const stores: SimStore[] = [
    {
      id: nextId(),
      name: 'Kroger via Instacart',
      provider: 'instacart',
      compositeScore: 0.92,
      storeId: chaos.shouldInstacartReturnNullStore() ? null : `inst-${nextId()}`,
    },
    {
      id: nextId(),
      name: 'Walmart Supercenter',
      provider: 'walmart',
      compositeScore: 0.87,
      storeId: `wmt-${nextId()}`,
    },
    {
      id: nextId(),
      name: 'Kroger',
      provider: 'kroger',
      compositeScore: 0.84,
      storeId: `kgr-${nextId()}`,
    },
  ];
  return stores.sort((a, b) => b.compositeScore - a.compositeScore);
}

async function stepBuildCart(
  provider: SimProvider,
  estimatedCostCents: number,
  store: SimStore,
  chaos: ChaosInjector,
): Promise<SimCart> {
  if (chaos.shouldFailGlobally()) throw new Error(`${provider}: cart build failed`);

  await chaos.applyProviderLatency(provider);
  await sleep(LATENCY.cartBuild());

  // Provider price markup simulation
  const markup: Record<SimProvider, number> = {
    instacart: 1.07,
    walmart: 0.91,
    kroger: 0.97,
  };
  const totalCents = Math.round(estimatedCostCents * markup[provider] * randBetween(0.85, 1.1));

  return {
    id: nextId(),
    provider,
    storeName: store.name,
    totalCents,
    itemCount: 12 + Math.floor(Math.random() * 22),
    coverageScore: randBetween(0.72, 0.98),
  };
}

async function stepCheckout(
  store: SimStore,
  cart: SimCart,
  chaos: ChaosInjector,
): Promise<string> {
  // Instacart null-store failure
  if (store.storeId === null) throw new Error('Instacart: storeId is null');

  // Kroger OAuth failure
  if (store.provider === 'kroger' && chaos.shouldKrogerFail()) {
    throw new Error('Kroger: OAuth token refresh failed (401)');
  }

  // Global failure storm
  if (chaos.shouldFailGlobally()) throw new Error(`${store.provider}: provider API down`);

  await chaos.applyProviderLatency(store.provider);
  await sleep(LATENCY.checkout());

  const urls: Record<SimProvider, string> = {
    instacart: `https://www.instacart.com/store/${store.storeId}/cart/${cart.id}`,
    walmart: `https://www.walmart.com/checkout?cart=${cart.id}&fulfillment=delivery`,
    kroger: `https://www.kroger.com/checkout?source=autopilot&cart=${cart.id}`,
  };
  return urls[store.provider];
}

// ─── Telemetry (fire-and-forget, chaos-aware) ─────────────────────────────────

function emitTelemetry(
  eventType: string,
  userId: string,
  chaos: ChaosInjector,
  counter: { fired: number; dropped: number },
): void {
  if (chaos.shouldDropTelemetryEvent()) {
    counter.dropped++;
    return; // simulates 10% event drop
  }
  counter.fired++;
  fireAndForget(async () => {
    await sleep(LATENCY.telemetry());
    void { eventType, userId, ts: Date.now() }; // would write to DB/queue
  });
}

// ─── Full virtual user flow ───────────────────────────────────────────────────

export async function simulateUserFlow(
  user: VirtualUser,
  chaos: ChaosInjector,
): Promise<UserFlowResult> {
  const start = Date.now();
  const completed: string[] = [];
  const attempted: SimProvider[] = [];
  const telemetry = { fired: 0, dropped: 0 };

  const emit = (type: string) => emitTelemetry(type, user.userId, chaos, telemetry);

  try {
    // ── Step 1: Parse intent ──────────────────────────────────────────────
    await stepParseIntent(chaos);
    completed.push('intent');
    emit('intent_parsed');

    // ── Step 2: Generate meals ────────────────────────────────────────────
    const { estimatedCostCents } = await stepGenerateMeals(user.budgetCents, chaos);
    completed.push('meals');
    emit('meals_generated');

    // ── Step 3: Store lookup + ranking ────────────────────────────────────
    const stores = await stepFindStores(chaos);
    completed.push('stores');

    // ── Step 4: Checkout orchestration with fallback ───────────────────────
    emit('checkout_attempt_started');

    let checkoutUrl: string | undefined;
    let successCart: SimCart | undefined;
    let fallbackTriggered = false;

    for (const store of stores) {
      attempted.push(store.provider);
      try {
        const cart = await stepBuildCart(store.provider, estimatedCostCents, store, chaos);
        emit('cart_build_completed');

        const url = await stepCheckout(store, cart, chaos);
        checkoutUrl = url;
        successCart = cart;

        if (attempted.length > 1) {
          fallbackTriggered = true;
          emit('store_fallback_triggered');
        }

        emit('checkout_attempt_success');
        break;
      } catch {
        emit('cart_build_failed');
        emit('checkout_attempt_failed');
        // continue to next store — this IS the fallback logic being stressed
      }
    }

    if (!checkoutUrl || !successCart) {
      throw new Error(`All providers exhausted: ${attempted.join(' → ')}`);
    }

    completed.push('checkout');

    // ── Step 5: Savings (fire-and-forget, delayed under chaos) ────────────
    const delay = chaos.getSavingsWriteDelay();
    const originalCostCents = Math.round(estimatedCostCents * 1.15);
    const savingsCents = Math.max(0, originalCostCents - successCart.totalCents);

    fireAndForget(async () => {
      if (delay > 0) await sleep(scaled(delay));
      await sleep(LATENCY.savingsWrite());
      void { userId: user.userId, orderId: successCart!.id, savingsCents };
    });

    emit('savings_recorded');
    completed.push('savings');

    return {
      userId: user.userId,
      success: true,
      fallbackTriggered,
      providersAttempted: attempted,
      latencyMs: Date.now() - start,
      checkoutUrl,
      savingsAmount: savingsCents / 100,
      telemetryEventsDropped: telemetry.dropped,
      telemetryEventsFired: telemetry.fired,
      completedSteps: completed,
    };
  } catch (err) {
    emit('flow_failed');
    return {
      userId: user.userId,
      success: false,
      fallbackTriggered: false,
      providersAttempted: attempted,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
      savingsAmount: 0,
      telemetryEventsDropped: telemetry.dropped,
      telemetryEventsFired: telemetry.fired,
      completedSteps: completed,
    };
  }
}

// ─── User factory ─────────────────────────────────────────────────────────────

export function generateVirtualUsers(count: number, prefix = 'user'): VirtualUser[] {
  return Array.from({ length: count }, (_, i) => ({
    userId: `${prefix}-${nextId()}-${i}`,
    budgetCents: 10_000 + Math.floor(Math.random() * 5_001), // $100–$150
    zipCode: String(10_000 + Math.floor(Math.random() * 89_999)).padStart(5, '0'),
    sessionId: nextId(),
  }));
}

export { createChaosInjector };
export type { ChaosConfig };
