export type ErrorType =
  | 'AI_ERROR'
  | 'INVENTORY_ERROR'
  | 'GEO_ERROR'
  | 'AUTH_ERROR'
  | 'CACHE_ERROR'
  | 'QUEUE_ERROR'
  | 'VALIDATION_ERROR'
  | 'SYSTEM_ERROR';

export interface NormalizedError {
  type: ErrorType;
  message: string;
  recoverable: boolean;
  step?: string;
  originalMessage?: string;
}

// Maps known error patterns to structured types
const ERROR_PATTERNS: Array<{
  test: (msg: string) => boolean;
  type: ErrorType;
  recoverable: boolean;
}> = [
  { test: (m) => /anthropic|claude|ai|overloaded|rate_limit/i.test(m), type: 'AI_ERROR', recoverable: true },
  { test: (m) => /inventory|stock|unavailable|product/i.test(m), type: 'INVENTORY_ERROR', recoverable: true },
  { test: (m) => /zip|geo|store|location|coverage/i.test(m), type: 'GEO_ERROR', recoverable: true },
  { test: (m) => /auth|session|unauthorized|forbidden/i.test(m), type: 'AUTH_ERROR', recoverable: false },
  { test: (m) => /redis|cache|upstash/i.test(m), type: 'CACHE_ERROR', recoverable: true },
  { test: (m) => /queue|job|worker/i.test(m), type: 'QUEUE_ERROR', recoverable: true },
  { test: (m) => /validation|zod|invalid|schema/i.test(m), type: 'VALIDATION_ERROR', recoverable: false },
];

export function normalizeError(err: unknown, step?: string): NormalizedError {
  const raw = err instanceof Error ? err : new Error(String(err));
  const msg = raw.message;

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(msg)) {
      return {
        type: pattern.type,
        message: toUserMessage(pattern.type, msg),
        recoverable: pattern.recoverable,
        step,
        originalMessage: msg,
      };
    }
  }

  return {
    type: 'SYSTEM_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    recoverable: true,
    step,
    originalMessage: msg,
  };
}

function toUserMessage(type: ErrorType, original: string): string {
  switch (type) {
    case 'AI_ERROR': return 'AI service temporarily unavailable. Retrying with cached data if possible.';
    case 'INVENTORY_ERROR': return 'Could not verify product availability. Substitutes will be applied.';
    case 'GEO_ERROR': return 'Could not resolve your location. Using nearest available store.';
    case 'AUTH_ERROR': return 'Session expired. Please refresh the page.';
    case 'CACHE_ERROR': return 'Cache unavailable. Processing without cached data.';
    case 'QUEUE_ERROR': return 'Background processing error. Retrying.';
    case 'VALIDATION_ERROR': return original.replace('Validation failed:', '').trim() || 'Invalid input.';
    default: return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Wraps an async function and re-throws as NormalizedError.
 * Use in pipeline steps to guarantee all throws are structured.
 */
export async function withErrorBoundary<T>(
  fn: () => Promise<T>,
  step: string,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const normalized = normalizeError(err, step);
    const wrapped = new Error(normalized.message) as Error & { normalized: NormalizedError };
    wrapped.normalized = normalized;
    throw wrapped;
  }
}

export function isNormalizedError(err: unknown): err is Error & { normalized: NormalizedError } {
  return err instanceof Error && 'normalized' in err;
}
