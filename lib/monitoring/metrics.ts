type MetricType = 'latency' | 'ai_cost' | 'failure' | 'cache_hit' | 'cache_miss' | 'counter';

interface Metric {
  type: MetricType;
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

// In-memory ring buffer (production: ship to Datadog/Prometheus)
const buffer: Metric[] = [];
const MAX_BUFFER = 1000;

function record(type: MetricType, name: string, value: number, labels: Record<string, string> = {}): void {
  if (buffer.length >= MAX_BUFFER) buffer.shift();
  buffer.push({ type, name, value, labels, timestamp: Date.now() });
}

export const metrics = {
  latency(endpoint: string, durationMs: number) {
    record('latency', 'endpoint_latency_ms', durationMs, { endpoint });
  },

  aiCost(model: string, inputTokens: number, outputTokens: number) {
    // Approximate cost in microdollars
    const costUd = inputTokens * 3 + outputTokens * 15; // claude-3.5-sonnet pricing per M tokens
    record('ai_cost', 'ai_cost_microdollars', costUd, { model });
  },

  failure(endpoint: string, reason: string) {
    record('failure', 'endpoint_failure', 1, { endpoint, reason });
  },

  cacheHit(namespace: string) {
    record('cache_hit', 'cache_hits', 1, { namespace });
  },

  cacheMiss(namespace: string) {
    record('cache_miss', 'cache_misses', 1, { namespace });
  },

  increment(name: string, labels: Record<string, string> = {}) {
    record('counter', name, 1, labels);
  },

  getSnapshot() {
    const now = Date.now();
    const window = buffer.filter((m) => m.timestamp > now - 60_000);

    const latencies = window.filter((m) => m.type === 'latency').map((m) => m.value);
    const failures = window.filter((m) => m.type === 'failure').length;
    const cacheHits = window.filter((m) => m.type === 'cache_hit').length;
    const cacheMisses = window.filter((m) => m.type === 'cache_miss').length;
    const totalAiCost = window.filter((m) => m.type === 'ai_cost').reduce((s, m) => s + m.value, 0);

    return {
      p50LatencyMs: percentile(latencies, 0.5),
      p99LatencyMs: percentile(latencies, 0.99),
      failureCount: failures,
      cacheHitRate: cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0,
      aiCostMicrodollarsLastMin: totalAiCost,
      samplesInWindow: window.length,
    };
  },
};

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

export function withLatency<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  return fn().finally(() => metrics.latency(endpoint, Date.now() - start));
}
