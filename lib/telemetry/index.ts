// Structured telemetry — replaces console.log spaghetti.
// Future: swap the sink to Datadog, Axiom, or CloudWatch without touching callers.

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

function emit(level: LogLevel, context: string, message: string, data: Record<string, unknown> = {}): LogEntry {
  const entry: LogEntry = { level, context, message, data, timestamp: new Date().toISOString() };
  // Sink — swap this block to ship to an external service in production
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${entry.timestamp}] [${level.toUpperCase()}] [${context}]`, message, Object.keys(data).length ? data : '');
  return entry;
}

export const telemetry = {
  info:  (ctx: string, msg: string, data?: Record<string, unknown>) => emit('info',  ctx, msg, data),
  warn:  (ctx: string, msg: string, data?: Record<string, unknown>) => emit('warn',  ctx, msg, data),
  error: (ctx: string, msg: string, data?: Record<string, unknown>) => emit('error', ctx, msg, data),
  debug: (ctx: string, msg: string, data?: Record<string, unknown>) => emit('debug', ctx, msg, data),

  searchCompleted(data: { query: string; dbCount: number; aiCount: number; fallbackUsed: boolean; finalCount: number; durationMs: number }) {
    emit('info', 'Search', 'Search pipeline completed', data as Record<string, unknown>);
  },

  cacheHit(layer: string, key: string) {
    emit('debug', 'Cache', `HIT  ${layer}`, { key });
  },

  cacheMiss(layer: string, key: string) {
    emit('debug', 'Cache', `MISS ${layer}`, { key });
  },

  pricingApplied(data: { storeId: string; itemCount: number; totalCost: number; durationMs: number }) {
    emit('info', 'Pricing', 'Pricing applied', data as Record<string, unknown>);
  },

  providerCall(provider: string, operation: string, durationMs: number) {
    emit('info', `Provider:${provider}`, operation, { durationMs });
  },
};
