// ─── Adaptive Throttling ──────────────────────────────────────────────────────
// Sliding-window rate limiter + circuit breaker per store provider.
// Never throws — isAllowed() returns false so callers can skip or wait.

export type StoreProvider = 'walmart' | 'kroger' | 'instacart';
export type CircuitState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

export interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt: number;
  openedAt: number;
}

export interface ProviderHealth {
  provider: StoreProvider;
  circuitState: CircuitState;
  requestsLastSecond: number;
  limit: number;
  backoffMs: number;
}

// Max requests per second per provider
const STORE_LIMITS: Record<StoreProvider, number> = {
  walmart: 50,
  kroger: 30,
  instacart: 40,
};

const FAILURE_RATE_THRESHOLD = 0.30; // open circuit above 30% failure rate
const LATENCY_THRESHOLD_MS = 3_000;
const HALF_OPEN_PROBE_RATE = 0.10; // allow 10% of traffic in HALF_OPEN
const RECOVERY_WINDOW_MS = 30_000; // 30s before OPEN → HALF_OPEN

// Sliding window: tracks request timestamps (last 1s)
const windowTimestamps: Map<StoreProvider, number[]> = new Map();
// Tracks (success/failure counts) for failure-rate calculation
const recentOutcomes: Map<StoreProvider, Array<{ success: boolean; ts: number }>> = new Map();
const circuitBreakers: Map<StoreProvider, CircuitBreaker> = new Map();

function getWindow(provider: StoreProvider): number[] {
  if (!windowTimestamps.has(provider)) windowTimestamps.set(provider, []);
  return windowTimestamps.get(provider)!;
}

function getOutcomes(provider: StoreProvider): Array<{ success: boolean; ts: number }> {
  if (!recentOutcomes.has(provider)) recentOutcomes.set(provider, []);
  return recentOutcomes.get(provider)!;
}

function getCircuit(provider: StoreProvider): CircuitBreaker {
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(provider, {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastFailureAt: 0,
      openedAt: 0,
    });
  }
  return circuitBreakers.get(provider)!;
}

function evictOld(timestamps: number[], windowMs = 1_000): void {
  const cutoff = Date.now() - windowMs;
  while (timestamps.length > 0 && timestamps[0] < cutoff) timestamps.shift();
}

export function isAllowed(provider: StoreProvider): boolean {
  const circuit = getCircuit(provider);
  const now = Date.now();

  if (circuit.state === 'OPEN') {
    if (now - circuit.openedAt >= RECOVERY_WINDOW_MS) {
      circuit.state = 'HALF_OPEN';
    } else {
      return false;
    }
  }

  if (circuit.state === 'HALF_OPEN') {
    // Only allow a probe fraction through
    if (Math.random() > HALF_OPEN_PROBE_RATE) return false;
  }

  const window = getWindow(provider);
  evictOld(window);
  return window.length < STORE_LIMITS[provider];
}

export function trackRequest(provider: StoreProvider, success: boolean, latencyMs?: number): void {
  const now = Date.now();

  // Sliding window counter
  const window = getWindow(provider);
  window.push(now);

  // Outcome tracking (last 60s for failure-rate calc)
  const outcomes = getOutcomes(provider);
  const cutoff60 = now - 60_000;
  while (outcomes.length > 0 && outcomes[0].ts < cutoff60) outcomes.shift();
  outcomes.push({ success, ts: now });

  updateCircuitBreaker(provider, success, latencyMs);
}

export function updateCircuitBreaker(
  provider: StoreProvider,
  success: boolean,
  latencyMs?: number,
): void {
  const circuit = getCircuit(provider);
  const now = Date.now();
  const highLatency = latencyMs !== undefined && latencyMs > LATENCY_THRESHOLD_MS;

  if (!success || highLatency) {
    circuit.failures++;
    circuit.lastFailureAt = now;
  } else {
    circuit.successes++;
  }

  const outcomes = getOutcomes(provider);
  if (outcomes.length >= 10) {
    const total = outcomes.length;
    const failures = outcomes.filter((o) => !o.success).length;
    const failureRate = failures / total;

    if (circuit.state === 'CLOSED' && (failureRate > FAILURE_RATE_THRESHOLD || highLatency)) {
      circuit.state = 'OPEN';
      circuit.openedAt = now;
    }
  }

  if (circuit.state === 'HALF_OPEN' && success && !highLatency) {
    circuit.state = 'CLOSED';
    circuit.failures = 0;
    circuit.successes = 0;
  } else if (circuit.state === 'HALF_OPEN' && (!success || highLatency)) {
    circuit.state = 'OPEN';
    circuit.openedAt = now;
  }
}

export function calculateBackoff(provider: StoreProvider): number {
  const circuit = getCircuit(provider);
  if (circuit.state === 'OPEN') {
    const elapsed = Date.now() - circuit.openedAt;
    const remaining = Math.max(0, RECOVERY_WINDOW_MS - elapsed);
    return remaining;
  }
  // Sliding window near limit → gentle backoff
  const window = getWindow(provider);
  evictOld(window);
  const utilization = window.length / STORE_LIMITS[provider];
  if (utilization >= 0.9) return 200 + Math.round(utilization * 800);
  return 0;
}

export function getProviderHealth(provider: StoreProvider): ProviderHealth {
  const circuit = getCircuit(provider);
  const window = getWindow(provider);
  evictOld(window);
  return {
    provider,
    circuitState: circuit.state,
    requestsLastSecond: window.length,
    limit: STORE_LIMITS[provider],
    backoffMs: calculateBackoff(provider),
  };
}

export function getSystemHealth(): ProviderHealth[] {
  const providers: StoreProvider[] = ['walmart', 'kroger', 'instacart'];
  return providers.map(getProviderHealth);
}
