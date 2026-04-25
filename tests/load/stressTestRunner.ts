// ─── Stress Test Runner ──────────────────────────────────────────────────────
// Orchestrates four load patterns (spike, sustained, burst, failure_storm)
// with configurable chaos injection. Collects per-request metrics, computes
// percentiles, asserts system thresholds, and outputs a structured report.
//
// Run: npx ts-node --project tsconfig.json tests/load/stressTestRunner.ts

import {
  simulateUserFlow,
  generateVirtualUsers,
  UserFlowResult,
  VirtualUser,
} from './trafficSimulator';
import { createChaosInjector, ChaosConfig, CHAOS_PRESETS } from './chaosScenarios';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoadPattern = 'spike' | 'sustained' | 'burst' | 'failure_storm';

export interface StressTestMetrics {
  totalRequests: number;
  successRate: number;
  fallbackRate: number;
  avgLatency: number;
  p95Latency: number;
  checkoutFailures: number;
  telemetryDropRate: number;
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  actual: string;
  threshold: string;
}

export interface StressTestReport {
  pattern: LoadPattern;
  chaosScenario: string;
  metrics: StressTestMetrics;
  assertions: AssertionResult[];
  passed: boolean;
  wallClockMs: number;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  minCheckoutSuccessRate: 0.85,
  minFallbackSuccessRate: 0.70,  // applies when failures are present
  maxP95LatencyMs: 3_000,
  maxTelemetryDropRate: 0.15,
};

// ─── Metrics computation ──────────────────────────────────────────────────────

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function buildMetrics(results: UserFlowResult[]): StressTestMetrics {
  const total = results.length;
  if (total === 0) {
    return { totalRequests: 0, successRate: 0, fallbackRate: 0, avgLatency: 0, p95Latency: 0, checkoutFailures: 0, telemetryDropRate: 0 };
  }

  const successes      = results.filter((r) => r.success).length;
  const fallbacks      = results.filter((r) => r.fallbackTriggered).length;
  const failures       = results.filter((r) => !r.success).length;
  const latencies      = results.map((r) => r.latencyMs);
  const avgLatency     = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
  const p95            = percentile(latencies, 95);
  const totalEvents    = results.reduce((s, r) => s + r.telemetryEventsFired + r.telemetryEventsDropped, 0);
  const droppedEvents  = results.reduce((s, r) => s + r.telemetryEventsDropped, 0);

  return {
    totalRequests: total,
    successRate:   parseFloat((successes / total).toFixed(4)),
    fallbackRate:  parseFloat((fallbacks / total).toFixed(4)),
    avgLatency,
    p95Latency:    Math.round(p95),
    checkoutFailures: failures,
    telemetryDropRate: totalEvents > 0 ? parseFloat((droppedEvents / totalEvents).toFixed(4)) : 0,
  };
}

function runAssertions(
  metrics: StressTestMetrics,
  hasChaosFailures: boolean,
): AssertionResult[] {
  const assertions: AssertionResult[] = [
    {
      name: 'checkout_success_rate ≥ 85%',
      passed: metrics.successRate >= THRESHOLDS.minCheckoutSuccessRate,
      actual:    `${(metrics.successRate * 100).toFixed(1)}%`,
      threshold: '85%',
    },
    {
      name: 'p95_latency ≤ 3000ms',
      passed: metrics.p95Latency <= THRESHOLDS.maxP95LatencyMs,
      actual:    `${metrics.p95Latency}ms`,
      threshold: '3000ms',
    },
    {
      name: 'telemetry_drop_rate ≤ 15%',
      passed: metrics.telemetryDropRate <= THRESHOLDS.maxTelemetryDropRate,
      actual:    `${(metrics.telemetryDropRate * 100).toFixed(1)}%`,
      threshold: '15%',
    },
  ];

  // Fallback assertion only applies when the chaos config introduces failures,
  // because without failures there is nothing to fall back from.
  if (hasChaosFailures) {
    assertions.push({
      name: 'fallback_system_engaged (rate > 0 or success ≥ 85%)',
      passed: metrics.fallbackRate > 0 || metrics.successRate >= THRESHOLDS.minFallbackSuccessRate,
      actual:    `fallbackRate=${(metrics.fallbackRate * 100).toFixed(1)}% successRate=${(metrics.successRate * 100).toFixed(1)}%`,
      threshold: 'fallback > 0% OR success ≥ 70%',
    });
  }

  return assertions;
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function runConcurrent(
  users: VirtualUser[],
  chaos: ReturnType<typeof createChaosInjector>,
  concurrency: number,
): Promise<UserFlowResult[]> {
  const results: UserFlowResult[] = new Array(users.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < users.length) {
      const i = idx++;
      results[i] = await simulateUserFlow(users[i], chaos);
    }
  }

  const slots = Math.min(concurrency, users.length);
  await Promise.all(Array.from({ length: slots }, worker));
  return results;
}

// ─── Sustained load pool ──────────────────────────────────────────────────────
// Maintains `concurrency` concurrent flows for `durationMs`, replacing each
// flow immediately on completion. Simulates a real steady-state traffic pool.

async function runSustainedPool(
  concurrency: number,
  durationMs: number,
  chaos: ReturnType<typeof createChaosInjector>,
  label: string,
): Promise<UserFlowResult[]> {
  const results: UserFlowResult[] = [];
  const endAt = Date.now() + durationMs;
  const active = new Set<Promise<void>>();
  let spawned = 0;

  function spawnNext(): void {
    if (Date.now() >= endAt) return;
    const [user] = generateVirtualUsers(1, label);
    user.userId = `${label}-${spawned++}`;
    const p: Promise<void> = simulateUserFlow(user, chaos).then((r) => {
      results.push(r);
      active.delete(p);
      spawnNext(); // replace immediately
    });
    active.add(p);
  }

  // Fill the pool
  for (let i = 0; i < concurrency; i++) spawnNext();

  // Drain all active flows
  while (active.size > 0) {
    await Promise.race(Array.from(active));
  }

  return results;
}

// ─── Load patterns ────────────────────────────────────────────────────────────

async function runSpikeLoad(
  chaos: ReturnType<typeof createChaosInjector>,
): Promise<UserFlowResult[]> {
  // 0 → 1000 users over 10 waves (TIME_SCALE compresses wall clock)
  const waves = [50, 100, 150, 150, 150, 100, 100, 100, 50, 50]; // =1000 total
  const timeScale = parseFloat(process.env.STRESS_TIME_SCALE ?? '0.05');
  const waveIntervalMs = 1_000 * timeScale; // 50ms per wave in compressed time
  const results: UserFlowResult[] = [];

  for (let w = 0; w < waves.length; w++) {
    const users = generateVirtualUsers(waves[w], `spike-w${w}`);
    const batch = await runConcurrent(users, chaos, waves[w]);
    results.push(...batch);
    if (w < waves.length - 1) {
      await new Promise((r) => setTimeout(r, waveIntervalMs));
    }
  }

  return results;
}

async function runSustainedLoad(
  chaos: ReturnType<typeof createChaosInjector>,
): Promise<UserFlowResult[]> {
  const timeScale = parseFloat(process.env.STRESS_TIME_SCALE ?? '0.05');
  const durationMs = 60_000 * timeScale; // 3s at default scale
  return runSustainedPool(500, durationMs, chaos, 'sustained');
}

async function runBurstLoad(
  chaos: ReturnType<typeof createChaosInjector>,
): Promise<UserFlowResult[]> {
  const timeScale = parseFloat(process.env.STRESS_TIME_SCALE ?? '0.05');
  const totalDurationMs = 45_000 * timeScale;
  const endAt = Date.now() + totalDurationMs;
  const results: UserFlowResult[] = [];

  // Base load: 50 concurrent users maintained throughout
  const basePromise = runSustainedPool(50, totalDurationMs, chaos, 'burst-base');

  // Burst spikes every 5–15s (compressed)
  const spikeBatches: Promise<UserFlowResult[]>[] = [];
  let t = Date.now();
  while (t < endAt) {
    const intervalMs = randBetween(5_000, 15_000) * timeScale;
    await new Promise((r) => setTimeout(r, intervalMs));
    if (Date.now() >= endAt) break;
    const burstSize = Math.floor(randBetween(100, 300));
    const users = generateVirtualUsers(burstSize, 'burst-spike');
    spikeBatches.push(runConcurrent(users, chaos, burstSize));
    t = Date.now();
  }

  const [baseResults, ...spikeResults] = await Promise.all([basePromise, ...spikeBatches]);
  results.push(...baseResults, ...spikeResults.flat());
  return results;
}

async function runFailureStorm(
  _baseChaos: ReturnType<typeof createChaosInjector>,
): Promise<UserFlowResult[]> {
  // Override chaos to force 30% global API failures regardless of base config
  const stormChaos = createChaosInjector({
    ...CHAOS_PRESETS.failure_storm,
    telemetryDropRate: 0.1,
  });
  const timeScale = parseFloat(process.env.STRESS_TIME_SCALE ?? '0.05');
  const durationMs = 30_000 * timeScale;
  return runSustainedPool(500, durationMs, stormChaos, 'storm');
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runStressTest(
  pattern: LoadPattern,
  chaosConfig: ChaosConfig = CHAOS_PRESETS.none,
  chaosScenarioName = 'none',
): Promise<StressTestReport> {
  const chaos = createChaosInjector(chaosConfig);
  const wallStart = Date.now();

  let results: UserFlowResult[];
  switch (pattern) {
    case 'spike':          results = await runSpikeLoad(chaos); break;
    case 'sustained':      results = await runSustainedLoad(chaos); break;
    case 'burst':          results = await runBurstLoad(chaos); break;
    case 'failure_storm':  results = await runFailureStorm(chaos); break;
  }

  const hasChaosFailures =
    (chaosConfig.globalApiFailureRate ?? 0) > 0 ||
    (chaosConfig.krogerFailureRate ?? 0) > 0 ||
    (chaosConfig.instacartNullStoreRate ?? 0) > 0 ||
    pattern === 'failure_storm';

  const metrics    = buildMetrics(results);
  const assertions = runAssertions(metrics, hasChaosFailures);
  const passed     = assertions.every((a) => a.passed);
  const wallClockMs = Date.now() - wallStart;

  return { pattern, chaosScenario: chaosScenarioName, metrics, assertions, passed, wallClockMs };
}

// ─── Reporter ─────────────────────────────────────────────────────────────────

// Patterns that intentionally expose breaking points — failure is expected
const BREAKING_POINT_SCENARIOS = new Set(['failure_storm']);

function printReport(report: StressTestReport): void {
  const isBreakingPoint = BREAKING_POINT_SCENARIOS.has(report.chaosScenario) || report.pattern === 'failure_storm';
  const statusLabel = report.passed
    ? '✓ PASS'
    : isBreakingPoint ? '⚠ BREAKING POINT (expected)' : '✗ FAIL';
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${statusLabel}  pattern=${report.pattern}  chaos=${report.chaosScenario}  wall=${report.wallClockMs}ms`);
  if (isBreakingPoint && !report.passed) {
    console.log('  ↳ 30% global failure rate compounds across 3 pipeline steps — this exposes the system threshold.');
  }
  console.log('─'.repeat(60));
  console.log(JSON.stringify(report.metrics, null, 2));
  console.log('\nAssertions:');
  for (const a of report.assertions) {
    const icon = a.passed ? '  ✓' : '  ✗';
    console.log(`${icon}  ${a.name}`);
    console.log(`       actual=${a.actual}  threshold=${a.threshold}`);
  }
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('AUTOCART AI — Stress + Chaos Test Suite');
  console.log(`TIME_SCALE=${process.env.STRESS_TIME_SCALE ?? '0.05'} (set STRESS_TIME_SCALE=1 for real-time)\n`);

  const suite: Array<{ pattern: LoadPattern; chaos: ChaosConfig; name: string }> = [
    { pattern: 'spike',         chaos: CHAOS_PRESETS.none,            name: 'none' },
    { pattern: 'sustained',     chaos: CHAOS_PRESETS.none,            name: 'none' },
    { pattern: 'burst',         chaos: CHAOS_PRESETS.kroger_oauth_failure, name: 'kroger_oauth_failure' },
    { pattern: 'failure_storm', chaos: CHAOS_PRESETS.failure_storm,   name: 'failure_storm' },
    { pattern: 'sustained',     chaos: CHAOS_PRESETS.walmart_latency, name: 'walmart_latency' },
    { pattern: 'sustained',     chaos: CHAOS_PRESETS.instacart_null_stores, name: 'instacart_null_stores' },
    { pattern: 'sustained',     chaos: CHAOS_PRESETS.telemetry_drop,  name: 'telemetry_drop' },
  ];

  const reports: StressTestReport[] = [];
  let allPassed = true;

  for (const { pattern, chaos, name } of suite) {
    console.log(`Running: pattern=${pattern} chaos=${name}...`);
    const report = await runStressTest(pattern, chaos, name);
    reports.push(report);
    printReport(report);
    if (!report.passed) allPassed = false;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Suite result: ${allPassed ? '✓ ALL PASSED' : '✗ FAILURES DETECTED'}`);
  console.log(`Total patterns run: ${reports.length}`);
  console.log(`Passed: ${reports.filter((r) => r.passed).length} / ${reports.length}`);

  // Aggregate metrics across all runs
  const all = reports.map((r) => r.metrics);
  const aggregate = {
    totalRequests:    all.reduce((s, m) => s + m.totalRequests, 0),
    avgSuccessRate:   parseFloat((all.reduce((s, m) => s + m.successRate, 0) / all.length).toFixed(4)),
    avgFallbackRate:  parseFloat((all.reduce((s, m) => s + m.fallbackRate, 0) / all.length).toFixed(4)),
    maxP95Latency:    Math.max(...all.map((m) => m.p95Latency)),
    totalFailures:    all.reduce((s, m) => s + m.checkoutFailures, 0),
    avgTelemetryDrop: parseFloat((all.reduce((s, m) => s + m.telemetryDropRate, 0) / all.length).toFixed(4)),
  };

  console.log('\nAggregate across all patterns:');
  console.log(JSON.stringify(aggregate, null, 2));

  if (!allPassed) process.exit(1);
}

// Run main() when invoked directly (works under Node.js, ts-node, jiti, and similar runners).
// Checking STRESS_RUN env var allows import without execution in test harnesses.
if (process.env.STRESS_RUN !== 'false') {
  main().catch((err) => {
    console.error('[stress-test] Fatal:', err);
    process.exit(1);
  });
}
