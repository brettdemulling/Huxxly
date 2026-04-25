// ─── Chaos Scenarios ─────────────────────────────────────────────────────────
// Standalone — no infra dependencies. Injects realistic failure modes into the
// traffic simulator without touching production code.

export type SimProvider = 'instacart' | 'kroger' | 'walmart';

export interface ChaosConfig {
  // Walmart API latency injection (milliseconds)
  walmartLatencyRange?: [number, number];
  // Probability Kroger OAuth throws (0–1)
  krogerFailureRate?: number;
  // Probability Instacart returns null storeId (0–1)
  instacartNullStoreRate?: number;
  // Probability any telemetry event is silently dropped (0–1)
  telemetryDropRate?: number;
  // Extra delay added to savings writes (ms)
  savingsWriteDelayMs?: number;
  // Global API failure probability — all providers (0–1)
  globalApiFailureRate?: number;
}

export interface ChaosInjector {
  applyProviderLatency(provider: SimProvider): Promise<void>;
  shouldKrogerFail(): boolean;
  shouldInstacartReturnNullStore(): boolean;
  shouldDropTelemetryEvent(): boolean;
  getSavingsWriteDelay(): number;
  shouldFailGlobally(): boolean;
  config: ChaosConfig;
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createChaosInjector(config: ChaosConfig): ChaosInjector {
  return {
    config,

    async applyProviderLatency(provider) {
      if (provider === 'walmart' && config.walmartLatencyRange) {
        const [min, max] = config.walmartLatencyRange;
        await sleep(randBetween(min, max));
      }
    },

    shouldKrogerFail() {
      return Math.random() < (config.krogerFailureRate ?? 0);
    },

    shouldInstacartReturnNullStore() {
      return Math.random() < (config.instacartNullStoreRate ?? 0);
    },

    shouldDropTelemetryEvent() {
      return Math.random() < (config.telemetryDropRate ?? 0);
    },

    getSavingsWriteDelay() {
      return config.savingsWriteDelayMs ?? 0;
    },

    shouldFailGlobally() {
      return Math.random() < (config.globalApiFailureRate ?? 0);
    },
  };
}

// ─── Preset Scenarios ─────────────────────────────────────────────────────────

export const CHAOS_PRESETS = {
  none: {} as ChaosConfig,

  // Chaos scenario 1: Walmart API latency 3–8s
  walmart_latency: {
    walmartLatencyRange: [3_000, 8_000],
  } as ChaosConfig,

  // Chaos scenario 2: Kroger OAuth randomly fails 20%
  kroger_oauth_failure: {
    krogerFailureRate: 0.2,
  } as ChaosConfig,

  // Chaos scenario 3: Instacart returns null store IDs
  instacart_null_stores: {
    instacartNullStoreRate: 1.0,
  } as ChaosConfig,

  // Chaos scenario 4: Telemetry drops 10% of events
  telemetry_drop: {
    telemetryDropRate: 0.1,
  } as ChaosConfig,

  // Chaos scenario 5: Savings engine delayed writes
  savings_delay: {
    savingsWriteDelayMs: 2_000,
  } as ChaosConfig,

  // Load pattern: failure storm (30% global API failures)
  failure_storm: {
    globalApiFailureRate: 0.3,
  } as ChaosConfig,

  // Combined: all chaos at once (realistic worst-case)
  all_chaos: {
    walmartLatencyRange: [3_000, 8_000],
    krogerFailureRate: 0.2,
    instacartNullStoreRate: 0.5,
    telemetryDropRate: 0.1,
    savingsWriteDelayMs: 1_000,
  } as ChaosConfig,
} satisfies Record<string, ChaosConfig>;
