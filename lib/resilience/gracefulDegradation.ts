// ─── Graceful Degradation ─────────────────────────────────────────────────────
// Detects system health and selects the appropriate degradation mode.
// FULL → LITE_CHECKOUT → SINGLE_STORE_ONLY → CACHED_MEAL_PLAN (descending capability)

import { getSystemHealth, type ProviderHealth } from './adaptiveThrottling';

export type DegradationMode =
  | 'FULL'
  | 'LITE_CHECKOUT'
  | 'SINGLE_STORE_ONLY'
  | 'CACHED_MEAL_PLAN';

export interface SystemHealth {
  mode: DegradationMode;
  availableProviders: string[];
  degradedProviders: string[];
  reason: string;
}

function countOpenCircuits(health: ProviderHealth[]): number {
  return health.filter((h) => h.circuitState === 'OPEN').length;
}

function countDegraded(health: ProviderHealth[]): number {
  return health.filter((h) => h.circuitState !== 'CLOSED').length;
}

export function detectDegradationMode(): SystemHealth {
  const health = getSystemHealth();
  const openCircuits = countOpenCircuits(health);
  const degradedCount = countDegraded(health);
  const totalProviders = health.length;

  const availableProviders = health
    .filter((h) => h.circuitState !== 'OPEN')
    .map((h) => h.provider);
  const degradedProviders = health
    .filter((h) => h.circuitState !== 'CLOSED')
    .map((h) => h.provider);

  if (openCircuits === totalProviders) {
    return {
      mode: 'CACHED_MEAL_PLAN',
      availableProviders: [],
      degradedProviders: degradedProviders,
      reason: 'All provider circuits open — returning cached meal plan only',
    };
  }

  if (openCircuits >= 2 || (degradedCount === totalProviders)) {
    return {
      mode: 'SINGLE_STORE_ONLY',
      availableProviders: availableProviders.slice(0, 1),
      degradedProviders,
      reason: `${openCircuits} circuits open — limiting to single best provider`,
    };
  }

  if (degradedCount >= 1) {
    return {
      mode: 'LITE_CHECKOUT',
      availableProviders,
      degradedProviders,
      reason: `${degradedCount} provider(s) degraded — skipping non-critical enrichment`,
    };
  }

  return {
    mode: 'FULL',
    availableProviders: availableProviders,
    degradedProviders: [],
    reason: 'All systems nominal',
  };
}

export function shouldActivateLiteMode(): boolean {
  const { mode } = detectDegradationMode();
  return mode !== 'FULL';
}

export interface DegradedFlowResult {
  mode: DegradationMode;
  message: string;
  skipSteps: string[];
  allowedProviders: string[];
}

// Maps mode to which pipeline steps can be skipped to recover speed/availability
const SKIP_STEPS_BY_MODE: Record<DegradationMode, string[]> = {
  FULL: [],
  LITE_CHECKOUT: ['price_optimization', 'confidence_scoring', 'savings_enrichment'],
  SINGLE_STORE_ONLY: ['price_optimization', 'confidence_scoring', 'savings_enrichment', 'store_ranking', 'fallback_ranking'],
  CACHED_MEAL_PLAN: ['price_optimization', 'confidence_scoring', 'savings_enrichment', 'store_ranking', 'fallback_ranking', 'cart_build', 'checkout'],
};

const MODE_MESSAGES: Record<DegradationMode, string> = {
  FULL: 'All systems operational.',
  LITE_CHECKOUT: 'Running in lite mode — price comparison skipped for speed.',
  SINGLE_STORE_ONLY: 'Reduced to single store — multiple providers temporarily unavailable.',
  CACHED_MEAL_PLAN: 'Checkout unavailable — showing your meal plan. Retry in a few minutes.',
};

export function executeDegradedFlow(systemHealth: SystemHealth): DegradedFlowResult {
  return {
    mode: systemHealth.mode,
    message: MODE_MESSAGES[systemHealth.mode],
    skipSteps: SKIP_STEPS_BY_MODE[systemHealth.mode],
    allowedProviders: systemHealth.availableProviders,
  };
}
