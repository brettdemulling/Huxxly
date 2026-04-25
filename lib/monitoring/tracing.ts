import { randomBytes } from 'crypto';
import { metrics } from './metrics';

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
  error?: string;
}

export interface TraceContext {
  traceId: string;
  userId?: string;
  requestPath?: string;
  startedAt: number;
  spans: SpanData[];
}

// In-memory store (production: ship to Datadog/OTLP collector)
const activeTraces = new Map<string, TraceContext>();
const MAX_TRACES = 500;

function genId(bytes = 8): string {
  return randomBytes(bytes).toString('hex');
}

export function startTrace(userId?: string, requestPath?: string): TraceContext {
  if (activeTraces.size >= MAX_TRACES) {
    // Evict oldest
    const oldest = activeTraces.keys().next().value;
    if (oldest) activeTraces.delete(oldest);
  }

  const ctx: TraceContext = {
    traceId: genId(16),
    userId,
    requestPath,
    startedAt: Date.now(),
    spans: [],
  };
  activeTraces.set(ctx.traceId, ctx);
  return ctx;
}

export function startSpan(
  traceId: string,
  name: string,
  attributes: Record<string, string | number | boolean> = {},
  parentSpanId?: string,
): SpanData {
  const span: SpanData = {
    traceId,
    spanId: genId(),
    parentSpanId,
    name,
    startedAt: Date.now(),
    status: 'ok',
    attributes,
  };

  const trace = activeTraces.get(traceId);
  if (trace) trace.spans.push(span);

  return span;
}

export function endSpan(span: SpanData, error?: unknown): SpanData {
  span.endedAt = Date.now();
  span.durationMs = span.endedAt - span.startedAt;

  if (error) {
    span.status = 'error';
    span.error = error instanceof Error ? error.message : String(error);
    metrics.failure(span.name, span.error);
  }

  metrics.latency(span.name, span.durationMs);
  return span;
}

export async function withSpan<T>(
  traceId: string,
  name: string,
  fn: (span: SpanData) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
): Promise<T> {
  const span = startSpan(traceId, name, attributes);
  try {
    const result = await fn(span);
    endSpan(span);
    return result;
  } catch (err) {
    endSpan(span, err);
    throw err;
  }
}

export function getTrace(traceId: string): TraceContext | undefined {
  return activeTraces.get(traceId);
}

export function finalizeTrace(traceId: string): TraceContext | undefined {
  const trace = activeTraces.get(traceId);
  activeTraces.delete(traceId);
  if (!trace) return undefined;

  const totalMs = Date.now() - trace.startedAt;
  const errorSpans = trace.spans.filter((s) => s.status === 'error').length;

  // Emit structured log for production ingestion
  console.log(
    JSON.stringify({
      level: errorSpans > 0 ? 'warn' : 'info',
      event: 'trace_complete',
      traceId: trace.traceId,
      userId: trace.userId,
      path: trace.requestPath,
      totalMs,
      spanCount: trace.spans.length,
      errorSpans,
      spans: trace.spans.map((s) => ({
        name: s.name,
        durationMs: s.durationMs,
        status: s.status,
        error: s.error,
      })),
    }),
  );

  return trace;
}

export function summarizeTrace(trace: TraceContext): {
  totalMs: number;
  stepBreakdown: Record<string, number>;
  errorSteps: string[];
  cacheHits: number;
} {
  const totalMs = (Date.now() - trace.startedAt);
  const stepBreakdown: Record<string, number> = {};
  const errorSteps: string[] = [];
  let cacheHits = 0;

  for (const span of trace.spans) {
    stepBreakdown[span.name] = span.durationMs ?? 0;
    if (span.status === 'error') errorSteps.push(span.name);
    if (span.attributes.cacheHit) cacheHits++;
  }

  return { totalMs, stepBreakdown, errorSteps, cacheHits };
}
